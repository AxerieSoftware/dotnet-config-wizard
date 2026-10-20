namespace Sample.Greeting;

/// <summary>Builds greetings. Kept free of analyzer findings so its test project builds under every preset.</summary>
public static class Greeter
{
	/// <summary>Greets someone by name.</summary>
	public static string ToGreeting(string name) => string.Concat("Hello, ", name);
}
