import { Link } from "react-router-dom";
import EterniaLogo from "@/components/EterniaLogo";

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Security", href: "#security" },
    { label: "Pricing", href: "#" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Contact", href: "#" },
  ],
  Legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "DPDP", href: "/dpdp" },
  ],
};

const Footer = () => (
  <footer className="border-t border-border/20" role="contentinfo">
    <div className="container mx-auto px-4 sm:px-5 py-10 sm:py-14">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
        {/* Brand */}
        <div className="col-span-2 sm:col-span-1">
          <Link to="/" className="flex items-center mb-3">
            <EterniaLogo size={32} />
          </Link>
          <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-[200px] mb-3">
            Anonymous student wellbeing, built for institutions.
          </p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-eternia-success animate-pulse" />
            <span className="text-[10px] text-muted-foreground/40">All systems operational</span>
          </div>
        </div>

        {Object.entries(footerLinks).map(([title, links]) => (
          <div key={title}>
            <h4 className="text-[10px] font-semibold text-foreground/70 uppercase tracking-widest mb-3">{title}</h4>
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("/") ? (
                    <Link to={link.href} className="text-[12px] sm:text-[13px] text-muted-foreground/50 hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  ) : (
                    <a href={link.href} className="text-[12px] sm:text-[13px] text-muted-foreground/50 hover:text-foreground transition-colors">
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>

    <div className="border-t border-border/10">
      <div className="container mx-auto px-4 sm:px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-[11px] sm:text-xs text-muted-foreground/70">
          © {new Date().getFullYear()} Eternia
        </p>
        <p className="text-[11px] sm:text-xs text-muted-foreground/70">
          Built with ❤️ for student wellbeing
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
