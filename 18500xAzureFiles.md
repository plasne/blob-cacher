# Goal

How fast can we copy 18,500 files from Azure Files Premium.

# Results

The upload test is included for completeness.

All tests were performed using "cp" unless otherwise noted.

This was tested on an NVv2 in the US West Azure Region on Ubuntu 18.04 unless otherwise noted.

I would also like to test a 100TB share which should improve performance.

## Upload to 5TB share

**79.7 minutes**

File share Premium
5 TB
Allowed IO/s 5120
Burst IO/s 15360
Throughput 612 MB/s
79.7 minutes
