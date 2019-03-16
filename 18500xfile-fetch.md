# Goal

How fast can we get 15,000 100 KB files + 3,500 80 MB files down to the client.

# Results

The upload test is included for completeness. AzCopy v7.3.0 proved faster than v10.0.0.

This was tested on an NVv2 in the US West Azure Region.

## Upload using AzCopy 7.3.0 Ubuntu

**5 minutes, 10 seconds**

[2019/03/07 15:50:40] Transfer summary:
Total files transferred: 18500
Transfer successfully: 18500
Transfer skipped: 0
Transfer failed: 0
Elapsed time: 00.00:05:10

I also tested using random file names so the partitioning for small files would be evenly distributed - it didn't affect the upload.

[2019/03/12 14:47:54] Transfer summary:
Total files transferred: 18500
Transfer successfully: 18500
Transfer skipped: 0
Transfer failed: 0
Elapsed time: 00.00:05:24

## AzCopy 7.3.0 Ubuntu

**10 minutes, 55 seconds**

The parallel level of 32 (default) seemed to produce the best results.

Download
[2019/03/07 16:04:31] Transfer summary:
Total files transferred: 18500
Transfer successfully: 18500
Transfer skipped: 0
Transfer failed: 0
Elapsed time: 00.00:10:55

Download --parallel-level 512
[2019/03/07 16:24:23] Transfer summary:
Total files transferred: 18500
Transfer successfully: 18500
Transfer skipped: 0
Transfer failed: 0
Elapsed time: 00.00:12:01

Download --parallel-level 32
[2019/03/07 16:36:56] Transfer summary:
Total files transferred: 18500
Transfer successfully: 18500
Transfer skipped: 0
Transfer failed: 0
Elapsed time: 00.00:10:55

I also attempted the download using random file names so the partitioning for small files would be even distributed - it didn't affect the download.

[2019/03/12 15:12:13] Transfer summary:
Total files transferred: 18500
Transfer successfully: 18500
Transfer skipped: 0
Transfer failed: 0
Elapsed time: 00.00:10:58

## AzCopy 10.0.0-Preview Ubuntu

**12 minutes, 17 seconds**

Job e8014c4b-9a4a-294c-52c3-6245f0cf5767 summary
Elapsed Time (Minutes): 12.3156
Total Number Of Transfers: 18500
Number of Transfers Completed: 18500
Number of Transfers Failed: 0
Number of Transfers Skipped: 0
TotalBytesTransferred: 297533440000
Final Job Status: Completed

Job 7e017f5b-d200-824c-62cb-4d3b31b25289 summary
Elapsed Time (Minutes): 12.2606
Total Number Of Transfers: 18500
Number of Transfers Completed: 18500
Number of Transfers Failed: 0
Number of Transfers Skipped: 0
TotalBytesTransferred: 297533440000
Final Job Status: Completed
