﻿using System;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Runtime;
using System.Diagnostics;
using CommandLine;
using Microsoft.WindowsAzure.Storage;
using Microsoft.WindowsAzure.Storage.Blob;
using Bogus;
using dotenv.net;

namespace blob_cacher_dotnet_test
{
    class Program
    {

        public class Options
        {
            [Option('z', "file-size", Required = false, HelpText = "FILE_SIZE. The file to be used for testing will be roughly this size in kilobytes. Default is \"100\" kb.")]
            public int FileSize { get; set; }

            [Option('n', "file-count", Required = false, HelpText = "FILE_COUNT. The number of files to create (simultaneous). Default is \"100\".")]
            public int FileCount { get; set; }

            [Option('s', "connection-string", Required = false, HelpText = "[REQUIRED] CONNECTION_STRING. The connection string to connect to the Azure Blob Storage Account.")]
            public string ConnectionString { get; set; }

            [Option('c', "container", Required = false, HelpText = "[REQUIRED] STORAGE_CONTAINER. The name of the storage container.")]
            public string Container { get; set; }
        }

        static int GetIntValue(int option, string envname, int dflt)
        {
            if (option > 0) return option;
            string var = Environment.GetEnvironmentVariable(envname);
            if (!string.IsNullOrEmpty(var))
            {
                int result;
                if (int.TryParse(var, out result)) return result;
            }
            return dflt;
        }

        static string GetStringValue(string option, string envname, string dflt)
        {
            if (!string.IsNullOrEmpty(option)) return option;
            string var = Environment.GetEnvironmentVariable(envname);
            if (!string.IsNullOrEmpty(var)) return var;
            return dflt;
        }

        static void Main(string[] args)
        {
            DotEnv.Config();
            Parser.Default.ParseArguments<Options>(args).WithParsed<Options>(o =>
                {

                    // variables
                    Faker faker = new Faker();
                    List<Task> tasks = new List<Task>();
                    int FILE_SIZE = Program.GetIntValue(o.FileSize, "FILE_SIZE", 100);
                    int FILE_COUNT = Program.GetIntValue(o.FileCount, "FILE_COUNT", 100);
                    string CONNECTION_STRING = Program.GetStringValue(o.ConnectionString, "CONNECTION_STRING", "");
                    string STORAGE_CONTAINER = Program.GetStringValue(o.Container, "STORAGE_CONTAINER", "");

                    // log
                    Console.WriteLine($"FILE_SIZE is \"{FILE_SIZE}\"");
                    Console.WriteLine($"FILE_COUNT is \"{FILE_COUNT}\"");
                    string connIsProvided = (!string.IsNullOrEmpty(CONNECTION_STRING)) ? "provided" : "missing";
                    Console.WriteLine($"CONNECTION_STRING is \"{connIsProvided}\"");
                    Console.WriteLine($"STORAGE_CONTAINER is \"{STORAGE_CONTAINER}\"");

                    // validate
                    if (string.IsNullOrEmpty(CONNECTION_STRING) || string.IsNullOrEmpty(STORAGE_CONTAINER))
                    {
                        throw new Exception("You must specify both CONNECTION_STRING and STORAGE_CONTAINER.");
                    }

                    // connect to cloud storage
                    CloudStorageAccount account = null;
                    if (CloudStorageAccount.TryParse(CONNECTION_STRING, out account))
                    {

                        // establish the client
                        CloudBlobClient client = account.CreateCloudBlobClient();
                        client.DefaultRequestOptions.SingleBlobUploadThresholdInBytes = 4 * 1024 * 1024;
                        CloudBlobContainer container = client.GetContainerReference(STORAGE_CONTAINER);

                        // run all at the same time
                        Stopwatch watch = Stopwatch.StartNew();
                        for (int i = 0; i < FILE_COUNT; i++)
                        {

                            // generate random data
                            string id = Guid.NewGuid().ToString();
                            string data = string.Join(' ', faker.Lorem.Words(150 * FILE_SIZE));

                            // start uploading all threads at the same time
                            CloudBlockBlob blob = container.GetBlockBlobReference(id);
                            Task task = blob.UploadTextAsync(data);
                            tasks.Add(task);

                        }

                        // report on the time it took
                        Task.WaitAll(tasks.ToArray());
                        watch.Stop();
                        Console.WriteLine(watch.ElapsedMilliseconds + " milliseconds");

                    }

                });

        }
    }
}
