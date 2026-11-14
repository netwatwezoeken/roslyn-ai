namespace ConsoleApp1;

public class DeadCode
{
    public static void M(int i, int j)
    {
        if (i != 0)
        {
            return;
        }

        if (j != 0)
        {
            return;
        }

        // Below condition will always evaluate to 'false' as 'i' and 'j' are both '0' here.
        if (i != j)
        {
            // Code in this 'if' branch is dead code.
            // It can either be removed or refactored.
            return;
        }
    }
}
