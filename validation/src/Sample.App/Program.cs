var numbers = new[] { 1, 2, 3 };
int sum = 0;
foreach (int number in numbers)
{
	if (number > 1)
		sum += number;
}

Console.WriteLine($"Sum: {sum}");
