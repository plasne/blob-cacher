# Goal

How fast can we get a single 80 MB file from blob storage.

# Results

The results are all essentially the same. The small discrepencies vary from run to run. Given that there is no substantial difference, pulling an 80 MB file as a single operation is the easiest to code and maintain.

All these tests used Typescript/Node and were tested on the D32v2 SKU (unless otherwise noted).

## Get all in a single call

**543ms**

node dist/download.js --log-level silly --source-method url --concurrency 1
LOG_LEVEL is "silly".
2019-03-06T20:52:20.241Z info: URL is "https://pelasnehtbb.blob.core.windows.net/sized/large.file".
2019-03-06T20:52:20.242Z info: STORAGE_SAS is "defined"
2019-03-06T20:52:20.242Z info: CONCURRENCY is "1".
2019-03-06T20:52:20.243Z info: SOURCE_METHOD is "url".
2019-03-06T20:52:20.244Z verbose: starting @ 168.55055898427963
2019-03-06T20:52:20.244Z info: getting [0] 0 to 83886079 from https://pelasnehtbb.blob.core.windows.net/sized/large.file?sv=2018-03-28&ss=b&srt=sco&sp=rwdlac&se=2019-05-05T22:23:15Z&st=2019-03-04T15:23:15Z&spr=https&sig=o3qzVRM%2Brd%2FzDV%2F6PdJO3eVXp3TZ4MRXn2agO4fRTDQ%3D @ 169.26386299729347...
2019-03-06T20:52:20.302Z verbose: first byte received [0] @ 227.1344580054283...
2019-03-06T20:52:20.788Z verbose: measure "3. total time": 543.579771

### Faster performance on NVv2 in US West

**457ms**

For some reason the test in NVv2 in US West is faster by a pretty good margin. I doubt this is a VM throttling issue since neither should be close to any limits, I think this is likely a network issue whereby the storage is closer to the compute which may not be repeatable.

node dist/download.js --log-level silly --source-method url --concurrency 1
LOG_LEVEL is "silly".
2019-03-06T22:18:36.175Z info: URL is "https://pelasnehtbbw.blob.core.windows.net/sized/large.file".
2019-03-06T22:18:36.176Z info: STORAGE_SAS is "defined"
2019-03-06T22:18:36.176Z info: CONCURRENCY is "1".
2019-03-06T22:18:36.176Z info: SOURCE_METHOD is "url".
2019-03-06T22:18:36.177Z verbose: starting @ 152.6940249998588
2019-03-06T22:18:36.178Z info: getting [0] 0 to 83886079 from https://pelasnehtbbw.blob.core.windows.net/sized/large.file?sv=2018-03-28&ss=b&srt=sco&sp=rwdlac&se=2019-04-06T05:10:45Z&st=2019-03-06T22:10:45Z&spr=https&sig=rmrL3ImedCTuYGFOGC%2FgNbVDHw4z%2BCaGI0vkbi3K8TI%3D @ 153.25789399980567...
2019-03-06T22:18:36.241Z verbose: first byte received [0] @ 216.09964699996635...
2019-03-06T22:18:36.635Z verbose: measure "3. total time": 457.029131

## Get the file in 4 chunks

**548ms**

This test works on a single blob, but 4 simultaneous requests to get 4 chunks of the file and then reassemble using a writeable stream.

node dist/download.js --log-level silly --source-method url --concurrency 4
LOG_LEVEL is "silly".
2019-03-06T20:51:16.537Z info: URL is "https://pelasnehtbb.blob.core.windows.net/sized/large.file".
2019-03-06T20:51:16.538Z info: STORAGE_SAS is "defined"
2019-03-06T20:51:16.538Z info: CONCURRENCY is "4".
2019-03-06T20:51:16.538Z info: SOURCE_METHOD is "url".
2019-03-06T20:51:16.539Z verbose: starting @ 166.1731480062008
2019-03-06T20:51:16.540Z info: getting [0] 0 to 20971519 from https://pelasnehtbb.blob.core.windows.net/sized/large.file?sv=2018-03-28&ss=b&srt=sco&sp=rwdlac&se=2019-05-05T22:23:15Z&st=2019-03-04T15:23:15Z&spr=https&sig=o3qzVRM%2Brd%2FzDV%2F6PdJO3eVXp3TZ4MRXn2agO4fRTDQ%3D @ 166.87075200676918...
2019-03-06T20:51:16.540Z info: getting [1] 20971520 to 41943039 from https://pelasnehtbb.blob.core.windows.net/sized/large.file?sv=2018-03-28&ss=b&srt=sco&sp=rwdlac&se=2019-05-05T22:23:15Z&st=2019-03-04T15:23:15Z&spr=https&sig=o3qzVRM%2Brd%2FzDV%2F6PdJO3eVXp3TZ4MRXn2agO4fRTDQ%3D @ 167.54765501618385...
2019-03-06T20:51:16.540Z info: getting [2] 41943040 to 62914559 from https://pelasnehtbb.blob.core.windows.net/sized/large.file?sv=2018-03-28&ss=b&srt=sco&sp=rwdlac&se=2019-05-05T22:23:15Z&st=2019-03-04T15:23:15Z&spr=https&sig=o3qzVRM%2Brd%2FzDV%2F6PdJO3eVXp3TZ4MRXn2agO4fRTDQ%3D @ 167.72225600481033...
2019-03-06T20:51:16.541Z info: getting [3] 62914560 to 83886079 from https://pelasnehtbb.blob.core.windows.net/sized/large.file?sv=2018-03-28&ss=b&srt=sco&sp=rwdlac&se=2019-05-05T22:23:15Z&st=2019-03-04T15:23:15Z&spr=https&sig=o3qzVRM%2Brd%2FzDV%2F6PdJO3eVXp3TZ4MRXn2agO4fRTDQ%3D @ 167.86505699157715...
2019-03-06T20:51:16.602Z verbose: first byte received [3] @ 229.61947199702263...
2019-03-06T20:51:16.606Z verbose: first byte received [1] @ 233.55879199504852...
2019-03-06T20:51:16.615Z verbose: first byte received [2] @ 242.73673900961876...
2019-03-06T20:51:16.620Z verbose: first byte received [0] @ 246.94386100769043...
2019-03-06T20:51:17.088Z verbose: measure "3. total time": 548.105998

## Get from multiple files in 4 chunks

**567ms**

This test is the same as the last except instead of pulling from a single blob, I had 4 copies of the same blob and pulled a range from different ones. This was to rule out some kind of throttling on the main blob.

node dist/download.js --log-level silly --source-method round-robin --concurrency 4
LOG_LEVEL is "silly".
2019-03-06T20:49:23.289Z info: URL is "https://pelasnehtbb.blob.core.windows.net/sized/large.file".
2019-03-06T20:49:23.290Z info: STORAGE_SAS is "defined"
2019-03-06T20:49:23.290Z info: CONCURRENCY is "4".
2019-03-06T20:49:23.290Z info: SOURCE_METHOD is "round-robin".
2019-03-06T20:49:23.291Z verbose: starting @ 168.68036398291588
2019-03-06T20:49:23.291Z info: getting [0] 0 to 20971519 from https://pelasnehtbb.blob.core.windows.net/sized/large.file?sv=2018-03-28&ss=b&srt=sco&sp=rwdlac&se=2019-05-05T22:23:15Z&st=2019-03-04T15:23:15Z&spr=https&sig=o3qzVRM%2Brd%2FzDV%2F6PdJO3eVXp3TZ4MRXn2agO4fRTDQ%3D @ 169.32606700062752...
2019-03-06T20:49:23.292Z info: getting [1] 20971520 to 41943039 from https://pelasnehtbb.blob.core.windows.net/sized/large.1?sv=2018-03-28&ss=b&srt=sco&sp=rwdlac&se=2019-05-05T22:23:15Z&st=2019-03-04T15:23:15Z&spr=https&sig=o3qzVRM%2Brd%2FzDV%2F6PdJO3eVXp3TZ4MRXn2agO4fRTDQ%3D @ 169.90696999430656...
2019-03-06T20:49:23.292Z info: getting [2] 41943040 to 62914559 from https://pelasnehtbb.blob.core.windows.net/sized/large.2?sv=2018-03-28&ss=b&srt=sco&sp=rwdlac&se=2019-05-05T22:23:15Z&st=2019-03-04T15:23:15Z&spr=https&sig=o3qzVRM%2Brd%2FzDV%2F6PdJO3eVXp3TZ4MRXn2agO4fRTDQ%3D @ 170.1050709784031...
2019-03-06T20:49:23.292Z info: getting [3] 62914560 to 83886079 from https://pelasnehtbb.blob.core.windows.net/sized/large.3?sv=2018-03-28&ss=b&srt=sco&sp=rwdlac&se=2019-05-05T22:23:15Z&st=2019-03-04T15:23:15Z&spr=https&sig=o3qzVRM%2Brd%2FzDV%2F6PdJO3eVXp3TZ4MRXn2agO4fRTDQ%3D @ 170.23577198386192...
2019-03-06T20:49:23.361Z verbose: first byte received [0] @ 238.88492399454117...
2019-03-06T20:49:23.362Z verbose: first byte received [1] @ 239.8707289993763...
2019-03-06T20:49:23.362Z verbose: first byte received [2] @ 240.25613099336624...
2019-03-06T20:49:23.375Z verbose: first byte received [3] @ 252.67569398880005...
2019-03-06T20:49:23.859Z verbose: measure "3. total time": 567.151505

## Assemble the file from 4 different blobs

**521ms**

This test involved splitting the file into 4 separate blobs. Each piece was fetched at the same time and then assembled into a single file using a writeable stream.

node dist/download.js --log-level silly --url https://pelasnehtbb.blob.core.windows.net/sized/part --source-method assemble --concurrency 4
LOG_LEVEL is "silly".
2019-03-06T20:50:59.296Z info: URL is "https://pelasnehtbb.blob.core.windows.net/sized/part".
2019-03-06T20:50:59.297Z info: STORAGE_SAS is "defined"
2019-03-06T20:50:59.297Z info: CONCURRENCY is "4".
2019-03-06T20:50:59.297Z info: SOURCE_METHOD is "assemble".
2019-03-06T20:50:59.298Z verbose: starting @ 168.81466200947762
2019-03-06T20:50:59.298Z info: getting [0] 0 to 20971519 from https://pelasnehtbb.blob.core.windows.net/sized/part.0?sv=2018-03-28&ss=b&srt=sco&sp=rwdlac&se=2019-05-05T22:23:15Z&st=2019-03-04T15:23:15Z&spr=https&sig=o3qzVRM%2Brd%2FzDV%2F6PdJO3eVXp3TZ4MRXn2agO4fRTDQ%3D @ 169.52206501364708...
2019-03-06T20:50:59.299Z info: getting [1] 20971520 to 41943039 from https://pelasnehtbb.blob.core.windows.net/sized/part.1?sv=2018-03-28&ss=b&srt=sco&sp=rwdlac&se=2019-05-05T22:23:15Z&st=2019-03-04T15:23:15Z&spr=https&sig=o3qzVRM%2Brd%2FzDV%2F6PdJO3eVXp3TZ4MRXn2agO4fRTDQ%3D @ 170.17966902256012...
2019-03-06T20:50:59.299Z info: getting [2] 41943040 to 62914559 from https://pelasnehtbb.blob.core.windows.net/sized/part.2?sv=2018-03-28&ss=b&srt=sco&sp=rwdlac&se=2019-05-05T22:23:15Z&st=2019-03-04T15:23:15Z&spr=https&sig=o3qzVRM%2Brd%2FzDV%2F6PdJO3eVXp3TZ4MRXn2agO4fRTDQ%3D @ 170.3503700196743...
2019-03-06T20:50:59.299Z info: getting [3] 62914560 to 83886079 from https://pelasnehtbb.blob.core.windows.net/sized/part.3?sv=2018-03-28&ss=b&srt=sco&sp=rwdlac&se=2019-05-05T22:23:15Z&st=2019-03-04T15:23:15Z&spr=https&sig=o3qzVRM%2Brd%2FzDV%2F6PdJO3eVXp3TZ4MRXn2agO4fRTDQ%3D @ 170.48957002162933...
2019-03-06T20:50:59.361Z verbose: first byte received [1] @ 232.07568502426147...
2019-03-06T20:50:59.366Z verbose: first byte received [2] @ 236.80180901288986...
2019-03-06T20:50:59.366Z verbose: first byte received [0] @ 237.53321301937103...
2019-03-06T20:50:59.368Z verbose: first byte received [3] @ 238.99712002277374...
2019-03-06T20:50:59.820Z verbose: measure "3. total time": 521.496164

# Additional Testing

I would like to test with Golang and see if it is faster to write the output file. Node seems to have some difficulty with merging the streams into the output file efficiently.

# Multiple Writers

One interesting test I conducted was to convert the streams to buffers and then commit the buffers to a sparse file (using position) as soon as the buffer was full. This did actually run faster (in the 400ms range), but after further investigation, the problem is that the fs.write is not supported to have multiple writers in the file at the same time. Further research suggested that while this works fine on Linux (my tests were on macOS and Ubuntu) because kernal versions 3.14 and better support multiple writers, this would never work on Windows. If you could somehow do this safely, it might improve performance.
