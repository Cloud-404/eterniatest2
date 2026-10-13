import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const PACKAGES = [
  { credits: 25, price: "₹49", priceNum: 4900, popular: false, label: "Starter" },
  { credits: 60, price: "₹99", priceNum: 9900, popular: true, label: "Growth" },
  { credits: 130, price: "₹199", priceNum: 19900, popular: false, label: "Priority" },
];

export function usePurchaseCredits() {
  const { user, refreshCredits } = useAuth();
  const queryClient = useQueryClient();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchasingCredits, setPurchasingCredits] = useState<number | null>(null);

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const purchaseCredits = async (credits: number) => {
    if (!user) {
      toast.error("Please log in first");
      return;
    }

    setIsPurchasing(true);
    setPurchasingCredits(credits);

    try {
      // Step 1: Create order
      const { data, error } = await supabase.functions.invoke("purchase-credits", {
        body: { action: "create_order", credits },
      });

      if (error || !data?.order_id) {
        throw new Error(data?.error || "Failed to create order");
      }

      // Step 2: Load Razorpay
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error("Failed to load payment gateway");
      }

      // Step 3: Open Razorpay checkout
      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: "INR",
        name: "Eternia",
        description: `${credits} Care Credits (ECC)`,
        order_id: data.order_id,
        handler: async (response: any) => {
          try {
            // Step 4: Verify payment
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
              "purchase-credits",
              {
                body: {
                  action: "verify_payment",
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                },
              }
            );

            if (verifyError || !verifyData?.success) {
              throw new Error(verifyData?.error || "Payment verification failed");
            }

            toast.success(`${credits} ECC added to your account! 🎉`);
            refreshCredits();
            queryClient.invalidateQueries({ queryKey: ["credit-transactions"] });
          } catch (e: any) {
            toast.error(e.message || "Payment verification failed");
          } finally {
            setIsPurchasing(false);
            setPurchasingCredits(null);
          }
        },
        modal: {
          ondismiss: () => {
            setIsPurchasing(false);
            setPurchasingCredits(null);
          },
        },
        theme: {
          color: "#14b8a6",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response: any) => {
        toast.error("Payment failed. Please try again.");
        setIsPurchasing(false);
        setPurchasingCredits(null);
      });
      rzp.open();
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
      setIsPurchasing(false);
      setPurchasingCredits(null);
    }
  };

  return { purchaseCredits, isPurchasing, purchasingCredits, PACKAGES };
}
