import AnnouncementBanner from "@/components/landing/AnnouncementBanner";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import TrustLogos from "@/components/landing/TrustLogos";
import FeaturesSection from "@/components/landing/FeaturesSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import StatsSection from "@/components/landing/StatsSection";
import SecuritySection from "@/components/landing/SecuritySection";
import AboutSection from "@/components/landing/AboutSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import FAQSection from "@/components/landing/FAQSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      {/* Soft pastel ambient blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div className="absolute top-[10%] -left-20 w-96 h-96 rounded-full surface-pink opacity-40 blur-3xl" />
        <div className="absolute top-[40%] -right-24 w-[28rem] h-[28rem] rounded-full surface-lavender opacity-40 blur-3xl" />
        <div className="absolute top-[75%] left-1/4 w-80 h-80 rounded-full surface-mint opacity-30 blur-3xl" />
        <div className="absolute top-[110%] right-1/3 w-96 h-96 rounded-full surface-butter opacity-30 blur-3xl" />
      </div>

      <div className="relative z-10">
        <AnnouncementBanner />
        <Navbar />
        <main>
          <HeroSection />
          <TrustLogos />
          <section aria-label="Platform features">
            <FeaturesSection />
          </section>
          <section aria-label="How Eternia works">
            <HowItWorksSection />
          </section>
          <section aria-label="Platform statistics">
            <StatsSection />
          </section>
          <section aria-label="Security and privacy">
            <SecuritySection />
          </section>
          <section aria-label="About Eternia">
            <AboutSection />
          </section>
          <section aria-label="Student testimonials">
            <TestimonialsSection />
          </section>
          <section aria-label="Frequently asked questions">
            <FAQSection />
          </section>
          <section aria-label="Get started">
            <CTASection />
          </section>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Landing;
