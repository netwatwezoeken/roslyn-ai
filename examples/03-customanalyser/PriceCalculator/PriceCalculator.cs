namespace Example;

public class PriceCalculator
{
    public decimal CalculateTotalPrice(decimal price, User user, string shippingCountry)
    {
        // Apply a 10% holiday discount for all premium users.
        // This is for the Q4 campaign and must be removed after Jan 31st.
        // See ticket JIRA-512 for the official request from Marketing.
        if (user.IsPremium) {
            price *= 0.9m;
        }
        
        price += ShippingCosts(shippingCountry);
        
        return price;
    }

    private static decimal ShippingCosts(string shippingCountry)
    {
        return shippingCountry == "US" ? 20m : 10m;
    }
}

public record User(bool IsPremium);