# Goal

How fast can we download 40x 80MB files.

# Results

The calls were wrapped in a script that counted the number of seconds in execution so the batch queue time could be considered as well. The upload test is included for completeness.

This was tested on an NVv2 in the US West Azure Region.

## Upload

**~4 seconds**

Job 6f1a8c26-2bc1-7a42-4f97-332e3e960f25 summary
Elapsed Time (Minutes): 0.0667 _(4.002 seconds)_
Total Number Of Transfers: 40
Number of Transfers Completed: 40
Number of Transfers Failed: 0
Number of Transfers Skipped: 0
TotalBytesTransferred: 3355443200
Final Job Status: Completed

## AzCopy 7.3.0 Ubuntu

**4 seconds**

[2019/03/12 13:36:18] Transfer summary:
Total files transferred: 40
Transfer successfully: 40
Transfer skipped: 0
Transfer failed: 0
Elapsed time: 00.00:00:03
completed in 4 seconds.

[2019/03/12 13:39:45] Transfer summary:
Total files transferred: 40
Transfer successfully: 40
Transfer skipped: 0
Transfer failed: 0
Elapsed time: 00.00:00:03
completed in 4 seconds.

[2019/03/12 13:40:13] Transfer summary:
Total files transferred: 40
Transfer successfully: 40
Transfer skipped: 0
Transfer failed: 0
Elapsed time: 00.00:00:03
completed in 3 seconds.

[2019/03/12 13:40:44] Transfer summary:
Total files transferred: 40
Transfer successfully: 40
Transfer skipped: 0
Transfer failed: 0
Elapsed time: 00.00:00:03
completed in 4 seconds.

## Azcopy 10.0.0-Preview Ubuntu

**10 seconds**

Job accf83bb-4244-0540-5520-520cdcfcbe2a summary
Elapsed Time (Minutes): 0.1667
Total Number Of Transfers: 40
Number of Transfers Completed: 40
Number of Transfers Failed: 0
Number of Transfers Skipped: 0
TotalBytesTransferred: 3355443200
Final Job Status: Completed
completed in 10 seconds.

Job d78e0a1d-b52f-7c48-6f68-06e4b73ac9be summary
Elapsed Time (Minutes): 0.1667
Total Number Of Transfers: 40
Number of Transfers Completed: 40
Number of Transfers Failed: 0
Number of Transfers Skipped: 0
TotalBytesTransferred: 3355443200
Final Job Status: Completed
completed in 10 seconds.

Job d97fe223-fc2c-0842-5cf7-2cb0db5aac0b summary
Elapsed Time (Minutes): 0.1671
Total Number Of Transfers: 40
Number of Transfers Completed: 40
Number of Transfers Failed: 0
Number of Transfers Skipped: 0
TotalBytesTransferred: 3355443200
Final Job Status: Completed
completed in 10 seconds.
