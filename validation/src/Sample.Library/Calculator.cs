using System.Text;

namespace Sample.Library
{
	/// <summary>Adds numbers and keeps a running history.</summary>
	public class Calculator
	{
		private readonly List<int> history = new List<int>();
		private int total;

		/// <summary>Adds a value to the running total.</summary>
		public int Add(int value)
		{
			this.total = this.total + value;
			history.Add(value);
			return total;
		}

		/// <summary>Describes every value added so far.</summary>
		public string Describe()
		{
			StringBuilder builder = new StringBuilder();
			foreach (var value in history) { builder.Append(value).Append(", "); }
			return builder.ToString().TrimEnd(',', ' ');
		}

		/// <summary>Waits before returning the total.</summary>
		public async Task<int> GetTotalAsync()
		{
			await Task.Delay(1);
			return total;
		}
	}
}
