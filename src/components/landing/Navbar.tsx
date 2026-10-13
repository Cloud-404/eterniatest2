import { Link } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import EterniaLogo from "@/components/EterniaLogo";
import { useState, useRef, useEffect } from "react";

const navLinks = [
  {
    label: "Product",
    children: [
      { label: "Expert Connect", href: "#features", desc: "Book expert sessions" },
      { label: "Peer Connect", href: "#features", desc: "Anonymous peer chat" },
      { label: "BlackBox", href: "#features", desc: "Private expression" },
      { label: "Sound Therapy", href: "#features", desc: "Meditation & sounds" },
    ],
  },
  {
    label: "Platform",
    children: [
      { label: "How It Works", href: "#how-it-works", desc: "Three-step onboarding" },
      { label: "Security", href: "#security", desc: "DPDP compliant privacy" },
      { label: "Architecture", href: "#architecture", desc: "Built for scale" },
    ],
  },
  { label: "About", href: "#about" },
  { label: "FAQ", href: "#faq" },
  { label: "Testimonials", href: "#testimonials" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <motion.nav
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.15, duration: 0.4 }}
      className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-2xl"
    >
      <div className="container mx-auto px-4 sm:px-5 py-2.5 flex items-center justify-between">
        {/* Logo - left */}
        <Link to="/" className="flex items-center">
          <EterniaLogo size={32} />
        </Link>

        {/* Nav links - right side with dropdowns */}
        <div className="hidden md:flex items-center gap-1" ref={dropdownRef}>
          {navLinks.map((item) =>
            "children" in item && item.children ? (
              <div key={item.label} className="relative">
                <button
                  onClick={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
                  className="flex items-center gap-1 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/20"
                >
                  {item.label}
                  <ChevronDown className={`w-3 h-3 transition-transform ${openDropdown === item.label ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {openDropdown === item.label && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-1 w-56 rounded-xl bg-popover/95 backdrop-blur-xl border border-border shadow-2xl shadow-black/5 overflow-hidden"
                    >
                      <div className="py-1.5">
                        {item.children.map((child) => (
                          <a
                            key={child.label}
                            href={child.href}
                            onClick={() => setOpenDropdown(null)}
                            className="flex flex-col px-3.5 py-2.5 hover:bg-muted/20 transition-colors"
                          >
                            <span className="text-[13px] font-medium text-foreground">{child.label}</span>
                            <span className="text-[11px] text-muted-foreground">{child.desc}</span>
                          </a>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <a
                key={item.label}
                href={item.href}
                className="px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/20"
              >
                {item.label}
              </a>
            )
          )}
        </div>

        {/* CTA buttons - far right */}
        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden md:block">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-[13px] h-8">
              Sign in
            </Button>
          </Link>
          <Link to="/institution-code">
            <Button size="sm" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-[12px] px-4 h-8 font-medium">
              Get Started
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border/20 bg-background/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="px-4 py-3 space-y-0.5">
              {navLinks.map((item) =>
                "children" in item && item.children ? (
                  <div key={item.label}>
                    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">{item.label}</p>
                    {item.children.map((child) => (
                      <a
                        key={child.label}
                        href={child.href}
                        className="block px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                        onClick={() => setMobileOpen(false)}
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                ) : (
                  <a
                    key={item.label}
                    href={item.href}
                    className="block px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </a>
                )
              )}
              <Link
                to="/login"
                className="block px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/20"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
