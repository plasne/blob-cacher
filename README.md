## 2,400 100 KB writes

45 seconds to write 15,000 random 256K files
1588 seconds to write 3,500 random 80M files

## Single 80 MB fetch

550ms

cp ephemeral
30.0 minutes

TEST: NetApp with multiple cp streams

20 concurrent users

windows testing

how long does the script take to run against premium files?
how long does the script take to run against netapp?

How long to boot up a VM with a managed disk? (P50, P60, P70)

1:20 to boot Windows Server 2016
0:40 detach disk to running VM

-   az vm disk detach -g pelasne-boot --vm-name pelasne-boot -n pelasne-premium-1

0:38 attach disk to running VM

-   az vm disk attach -g pelasne-boot --vm-name pelasne-boot -n pelasne-premium-1

how long does the script take to run on ephemeral disk?
1890

how long does the script take to run on managed disk?
1831

how long does the script take to run against L32 ephemeral?
4792

how long does the script take to run against L32 P50?
4828
