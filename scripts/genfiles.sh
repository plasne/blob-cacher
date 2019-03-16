# $1 file prefix, ex. ./files/file-
# $2 size, ex. 262144
# $3 count, ex. 15000

start=$SECONDS
for (( i = 1; i <= $3; i++))
do
    filename=$1$( printf %05d "$i" ).file
    head -c $2 </dev/urandom >$filename
done
duration=$(( SECONDS - start ))
echo "completed in $SECONDS seconds."