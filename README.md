## 2,400 100 KB Writes

This test writes files as fast as possible to Azure Blob Storage.

-   45 seconds to write 15,000 random 256K files
-   1,588 seconds to write 3,500 random 80M files
-   [more info](2400x100k-write.md)

## Single File Read

This test reads a single file as fast as possible from Azure Blob Storage.

-   114 ms to read a 256K file
-   [more info](1x256kb-read.md)
-   457 ms to read a 80M file
-   [more info](1x80mb-read.md)

## 40 File Read

This test reads 40 80M files as fast as possible from Azure Blob Storage.

-   4 seconds
-   AzCopy version 7.3 was faster than version 10
-   [more info](40x80mb-read.md)

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
1839

how long does the script take to run against L32 ephemeral?
4792

how long does the script take to run against L32 P50?
4828

how long does the script take to run against Azure Files Premium 100TB?
17594

Local Ephmeral
-c100G -d10 -r -w50 -t8 -o8 -b8K -h -L D:\testfile.dat

total:
%-ile | Read (ms) | Write (ms) | Total (ms)

---

    min |      0.278 |      0.300 |      0.278

25th | 1.556 | 1.435 | 1.481
50th | 1.767 | 1.625 | 1.708
75th | 1.997 | 1.839 | 1.918
90th | 2.176 | 2.040 | 2.106
95th | 2.300 | 2.130 | 2.229
99th | 2.539 | 2.379 | 2.493
3-nines | 4.529 | 4.637 | 4.609
4-nines | 7.556 | 9.003 | 8.868
5-nines | 10.332 | 9.940 | 10.332
6-nines | 10.332 | 9.940 | 10.332
7-nines | 10.332 | 9.940 | 10.332
8-nines | 10.332 | 9.940 | 10.332
9-nines | 10.332 | 9.940 | 10.332
max | 10.332 | 9.940 | 10.332

Local P50
-c100G -d10 -r -w50 -t8 -o8 -b8K -h -L E:\testfile.dat

total:
%-ile | Read (ms) | Write (ms) | Total (ms)

---

    min |      0.087 |      2.794 |      0.087

25th | 3.415 | 3.956 | 3.740
50th | 46.098 | 46.686 | 46.368
75th | 47.987 | 49.008 | 48.515
90th | 49.523 | 50.378 | 49.907
95th | 49.947 | 52.574 | 50.815
99th | 53.888 | 72.380 | 65.245
3-nines | 77.273 | 88.150 | 88.150
4-nines | 97.739 | 92.251 | 97.739
5-nines | 97.739 | 92.251 | 97.739
6-nines | 97.739 | 92.251 | 97.739
7-nines | 97.739 | 92.251 | 97.739
8-nines | 97.739 | 92.251 | 97.739
9-nines | 97.739 | 92.251 | 97.739
max | 97.739 | 92.251 | 97.739

Local K?
-c100G -d10 -r -w50 -t8 -o8 -b8K -h -L K:\testfile.dat

total:
%-ile | Read (ms) | Write (ms) | Total (ms)

---

    min |     33.750 |     33.925 |     33.750

25th | 38.602 | 39.351 | 38.955
50th | 39.989 | 40.571 | 40.299
75th | 41.490 | 42.229 | 41.906
90th | 43.272 | 43.941 | 43.677
95th | 44.306 | 44.822 | 44.659
99th | 46.423 | 47.450 | 46.958
3-nines | 51.937 | 51.857 | 51.937
4-nines | 52.031 | 53.078 | 53.078
5-nines | 52.031 | 53.078 | 53.078
6-nines | 52.031 | 53.078 | 53.078
7-nines | 52.031 | 53.078 | 53.078
8-nines | 52.031 | 53.078 | 53.078
9-nines | 52.031 | 53.078 | 53.078
max | 52.031 | 53.078 | 53.078

L32 P50:

total:
%-ile | Read (ms) | Write (ms) | Total (ms)

---

    min |    141.376 |    140.618 |    140.618

25th | 147.017 | 147.387 | 147.223
50th | 148.795 | 149.165 | 148.993
75th | 150.563 | 151.051 | 150.776
90th | 151.932 | 152.384 | 152.187
95th | 153.145 | 153.607 | 153.406
99th | 155.021 | 156.357 | 155.792
3-nines | 156.924 | 164.639 | 157.833
4-nines | 157.208 | 174.964 | 174.964
5-nines | 157.208 | 174.964 | 174.964
6-nines | 157.208 | 174.964 | 174.964
7-nines | 157.208 | 174.964 | 174.964
8-nines | 157.208 | 174.964 | 174.964
9-nines | 157.208 | 174.964 | 174.964
max | 157.208 | 174.964 | 174.964

L32 Ephemeral:

total:
%-ile | Read (ms) | Write (ms) | Total (ms)

---

    min |     16.992 |     18.311 |     16.992

25th | 23.183 | 23.234 | 23.206
50th | 23.699 | 23.772 | 23.738
75th | 24.308 | 24.385 | 24.347
90th | 25.086 | 25.157 | 25.130
95th | 25.896 | 25.959 | 25.935
99th | 28.035 | 28.093 | 28.066
3-nines | 30.846 | 31.318 | 31.317
4-nines | 32.162 | 32.622 | 32.622
5-nines | 33.307 | 32.824 | 33.307
6-nines | 33.307 | 32.824 | 33.307
7-nines | 33.307 | 32.824 | 33.307
8-nines | 33.307 | 32.824 | 33.307
9-nines | 33.307 | 32.824 | 33.307
max | 33.307 | 32.824 | 33.307

Azure Files Premium

total:
%-ile | Read (ms) | Write (ms) | Total (ms)

---

    min |      1.323 |      2.224 |      1.323

25th | 2.407 | 3.817 | 2.858
50th | 2.916 | 4.271 | 3.351
75th | 3.187 | 4.687 | 4.306
90th | 3.419 | 5.108 | 4.844
95th | 3.591 | 5.492 | 5.250
99th | 820.461 | 824.047 | 822.613
3-nines | 862.917 | 868.956 | 866.688
4-nines | 883.880 | 885.107 | 885.107
5-nines | 889.769 | 891.950 | 891.950
6-nines | 889.769 | 891.950 | 891.950
7-nines | 889.769 | 891.950 | 891.950
8-nines | 889.769 | 891.950 | 891.950
9-nines | 889.769 | 891.950 | 891.950
max | 889.769 | 891.950 | 891.950

read

total:
%-ile | Read (ms) | Write (ms) | Total (ms)

---

    min |      1.737 |        N/A |      1.737

25th | 3.343 | N/A | 3.343
50th | 3.849 | N/A | 3.849
75th | 4.446 | N/A | 4.446
90th | 5.106 | N/A | 5.106
95th | 5.581 | N/A | 5.581
99th | 6.979 | N/A | 6.979
3-nines | 12.426 | N/A | 12.426
4-nines | 23.919 | N/A | 23.919
5-nines | 24.235 | N/A | 24.235
6-nines | 24.327 | N/A | 24.327
7-nines | 24.327 | N/A | 24.327
8-nines | 24.327 | N/A | 24.327
9-nines | 24.327 | N/A | 24.327
max | 24.327 | N/A | 24.327

write

total:
%-ile | Read (ms) | Write (ms) | Total (ms)

---

    min |        N/A |      2.725 |      2.725

25th | N/A | 4.149 | 4.149
50th | N/A | 4.373 | 4.373
75th | N/A | 4.643 | 4.643
90th | N/A | 5.000 | 5.000
95th | N/A | 5.386 | 5.386
99th | N/A | 6.957 | 6.957
3-nines | N/A | 10.899 | 10.899
4-nines | N/A | 15.596 | 15.596
5-nines | N/A | 19.685 | 19.685
6-nines | N/A | 20.622 | 20.622
7-nines | N/A | 20.622 | 20.622
8-nines | N/A | 20.622 | 20.622
9-nines | N/A | 20.622 | 20.622
max | N/A | 20.622 | 20.622

read/write

total:
%-ile | Read (ms) | Write (ms) | Total (ms)

---

    min |      2.111 |      2.778 |      2.111

25th | 3.434 | 4.125 | 3.749
50th | 3.941 | 4.627 | 4.307
75th | 4.562 | 5.234 | 4.962
90th | 5.238 | 5.892 | 5.648
95th | 5.733 | 6.371 | 6.127
99th | 7.060 | 7.635 | 7.404
3-nines | 16.820 | 12.491 | 13.031
4-nines | 25.397 | 26.595 | 26.269
5-nines | 26.556 | 27.469 | 26.962
6-nines | 26.556 | 27.469 | 27.469
7-nines | 26.556 | 27.469 | 27.469
8-nines | 26.556 | 27.469 | 27.469
9-nines | 26.556 | 27.469 | 27.469
max | 26.556 | 27.469 | 27.469
