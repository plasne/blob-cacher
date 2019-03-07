# Goal

How fast can we get a single 256 KB file from blob storage.

# Results

The file is small enough that it would always be pulled as a single thread. There was a lot of variance on pulling a 256 KB file (as low as 44ms and as high as 200ms).

These tests used Typescript/Node and were tested on the NVv2 SKU.

**114ms**

node dist/download.js --log-level silly --source-method url --concurrency 1 --file-size 275kb
LOG_LEVEL is "silly".
2019-03-06T22:54:29.018Z info: URL is "https://pelasnehtbbw.blob.core.windows.net/sized/small.file".
2019-03-06T22:54:29.019Z info: STORAGE_SAS is "defined"
2019-03-06T22:54:29.019Z info: FILE_SIZE is "275kb".
2019-03-06T22:54:29.019Z info: CONCURRENCY is "1".
2019-03-06T22:54:29.019Z info: SOURCE_METHOD is "url".
2019-03-06T22:54:29.020Z verbose: starting @ 151.8883490000153
2019-03-06T22:54:29.021Z info: getting [0] 0 to 281599 from https://pelasnehtbbw.blob.core.windows.net/sized/small.file?sv=2018-03-28&ss=b&srt=sco&sp=rwdlac&se=2019-04-06T05:10:45Z&st=2019-03-06T22:10:45Z&spr=https&sig=rmrL3ImedCTuYGFOGC%2FgNbVDHw4z%2BCaGI0vkbi3K8TI%3D @ 152.66913599998225...
2019-03-06T22:54:29.129Z verbose: first byte received [0] @ 260.60139600001276...
2019-03-06T22:54:29.135Z verbose: measure "3. total time": 114.430355
