namespace Example;

public class Testclass
{
    public int Id()
    {
        return IdAsync().Result;
    }

    public Task<int> IdAsync()
    {
        return Task.FromResult(1);
    }
}