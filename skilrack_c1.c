/*C-VIDEO- ARRAY
ProgramID-7108
SkillRack
Sum of Unique Elements in the Array
The program must accept a positive integer array of size N as the input. The program must print the sum of unique elements in the array as the output.
Boundary Condition(s):
3 <= N <= 50
1 <= Array Element Value <= 99
Input Format:
The first line contains the value of N.
The sceond line contains N integers separated by space(s).
Output Format:
The first line contains the sum of unique elements in the array.
Example Input/Output 1:
Input:
5 12342
Output:
8
Explanation:
The unique elements in the array are 1 3 4.
The sum of unique elements in the array is 8.
Hence the output is 8
Example Input/Output 2:
Input:
8 23452345
Output: 0
*/

#include <stdio.h>

int main() {
    int N;
    scanf("%d", &N);

    int arr[N];
    // Frequency array initialized to 0 (since element values are between 1 and 99)
    int freq[100] = {0};

    // Read array elements and count their frequencies
    for (int i = 0; i < N; i++) {
        scanf("%d", &arr[i]);
        freq[arr[i]]++;
    }

    int sum = 0;
    // Add elements that appear only once
    for (int i = 0; i < N; i++) {
        if (freq[arr[i]] == 1) {
            sum += arr[i];
        }
    }

    printf("%d\n", sum);
    return 0;
}
