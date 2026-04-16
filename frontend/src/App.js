import { useState, useEffect, createContext, useContext, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import Marquee from "react-fast-marquee";
import { 
  PencilLine, 
  Lightning, 
  Sparkle, 
  EnvelopeSimple, 
  ChatCircle, 
  Article, 
  ShoppingBag,
  Copy,
  Check,
  ArrowRight,
  Crown,
  User,
  SignOut,
  Gear,
  CaretDown,
  X,
  List,
  Gift,
  Share,
  Users
} from "@phosphor-icons/react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true
});

// Auth Context
const AuthContext = createContext(null);

const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await API.get("/auth/me");
      setUser(data);
    } catch {
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await API.post("/auth/login", { email, password });
    setUser(data);
    return data;
  };

  const register = async (email, password, name, referralCode = null) => {
    const { data } = await API.post("/auth/register", { email, password, name, referral_code: referralCode });
    setUser(data);
    return data;
  };

  const logout = async () => {
    await API.post("/auth/logout");
    setUser(false);
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected Route
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Format API Error
const formatError = (error) => {
  const detail = error.response?.data?.detail;
  if (!detail) return error.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(e => e.msg || JSON.stringify(e)).join(" ");
  return String(detail);
};

// ==================== COMPONENTS ====================

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="glass-header fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" data-testid="logo-link">
          <PencilLine size={28} weight="bold" className="text-[#002BF6]" />
          <span className="text-xl font-bold tracking-tight">WriteGenius</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          {user ? (
            <>
              <Link to="/dashboard" className="text-sm font-medium hover:text-[#002BF6] transition-colors" data-testid="nav-dashboard">
                Dashboard
              </Link>
              <Link to="/pricing" className="text-sm font-medium hover:text-[#002BF6] transition-colors" data-testid="nav-pricing">
                Pricing
              </Link>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-3 py-2 border border-zinc-200 hover:border-[#002BF6] transition-colors"
                  data-testid="user-menu-btn"
                >
                  <User size={18} />
                  <span className="text-sm font-medium">{user.name}</span>
                  {user.is_premium && <Crown size={14} className="text-amber-500" />}
                  <CaretDown size={14} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-zinc-200 shadow-lg">
                    <Link to="/dashboard" className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-zinc-50" onClick={() => setMenuOpen(false)}>
                      <Gear size={16} /> Settings
                    </Link>
                    <button onClick={() => { logout(); setMenuOpen(false); navigate("/"); }} className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-zinc-50 w-full text-left text-red-600" data-testid="logout-btn">
                      <SignOut size={16} /> Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium hover:text-[#002BF6] transition-colors" data-testid="nav-login">
                Login
              </Link>
              <Link to="/register" className="btn-primary px-5 py-2.5 text-sm" data-testid="nav-register">
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} data-testid="mobile-menu-btn">
          {mobileMenuOpen ? <X size={24} /> : <List size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-zinc-200 px-6 py-4">
          {user ? (
            <div className="space-y-3">
              <Link to="/dashboard" className="block py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
              <Link to="/pricing" className="block py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
              <button onClick={() => { logout(); setMobileMenuOpen(false); navigate("/"); }} className="block py-2 text-sm font-medium text-red-600">Logout</button>
            </div>
          ) : (
            <div className="space-y-3">
              <Link to="/login" className="block py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>Login</Link>
              <Link to="/register" className="block btn-primary px-4 py-2 text-sm text-center" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

// ==================== PAGES ====================

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const features = [
    { icon: ChatCircle, title: "Social Media", desc: "Engaging posts for all platforms" },
    { icon: EnvelopeSimple, title: "Emails", desc: "Professional business emails" },
    { icon: Article, title: "Blog Posts", desc: "SEO-optimized articles" },
    { icon: ShoppingBag, title: "Product Copy", desc: "Conversion-focused descriptions" }
  ];

  const marqueeItems = ["AI-Powered Writing", "50+ Languages", "Multiple Tones", "Instant Generation", "Save History", "Copy with One Click"];

  return (
    <div className="min-h-screen">
      <Navbar />
      
      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="animate-fade-in">
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-wider uppercase border border-zinc-200 mb-6">
              AI Writing Assistant
            </span>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tighter leading-none mb-6 animate-slide-up">
            Write Better.<br />
            <span className="text-[#002BF6]">Write Faster.</span>
          </h1>
          <p className="text-lg sm:text-xl text-zinc-600 max-w-2xl mx-auto mb-10 animate-fade-in stagger-2">
            Generate high-quality content for social media, emails, blogs, and more. 
            Powered by advanced AI, available in 50+ languages.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in stagger-3">
            <button 
              onClick={() => navigate(user ? "/dashboard" : "/register")} 
              className="btn-primary px-8 py-4 text-base flex items-center justify-center gap-2"
              data-testid="hero-cta"
            >
              Start Writing Free <ArrowRight size={20} weight="bold" />
            </button>
            <Link to="/pricing" className="px-8 py-4 text-base font-semibold border border-zinc-300 hover:border-[#002BF6] transition-colors flex items-center justify-center gap-2" data-testid="hero-pricing">
              View Pricing
            </Link>
          </div>
          <p className="text-sm text-zinc-500 mt-4 animate-fade-in stagger-4">
            <Lightning size={14} className="inline text-amber-500" /> 5 free generations daily • No credit card required
          </p>
        </div>
      </section>

      {/* Marquee */}
      <div className="marquee-container py-4">
        <Marquee speed={40} gradient={false}>
          {marqueeItems.map((item, i) => (
            <span key={i} className="mx-8 text-sm font-medium flex items-center gap-2">
              <Sparkle size={14} className="text-[#002BF6]" /> {item}
            </span>
          ))}
        </Marquee>
      </div>

      {/* Features Grid */}
      <section className="py-20 px-6 bg-zinc-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">
            Create Content for Any Purpose
          </h2>
          <p className="text-zinc-600 text-center max-w-xl mx-auto mb-12">
            From viral social posts to professional emails, WriteGenius has you covered.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-white border border-zinc-200 p-6 card-hover" data-testid={`feature-${f.title.toLowerCase().replace(" ", "-")}`}>
                <div className="w-12 h-12 bg-[#002BF6] text-white flex items-center justify-center mb-4">
                  <f.icon size={24} />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-zinc-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
            Ready to transform your writing?
          </h2>
          <button 
            onClick={() => navigate(user ? "/dashboard" : "/register")} 
            className="btn-primary px-10 py-4 text-lg"
            data-testid="cta-btn"
          >
            Get Started Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <PencilLine size={20} className="text-[#002BF6]" />
            <span className="font-bold">WriteGenius</span>
          </div>
          <p className="text-sm text-zinc-500">© 2026 WriteGenius. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6 pt-24">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h1>
          <p className="text-zinc-600 mb-8">Sign in to continue creating amazing content.</p>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm mb-6" data-testid="login-error">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-zinc-300 focus:border-[#002BF6] focus:ring-2 focus:ring-[#002BF6]/20 outline-none transition-colors"
                placeholder="you@example.com"
                required
                data-testid="login-email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-zinc-300 focus:border-[#002BF6] focus:ring-2 focus:ring-[#002BF6]/20 outline-none transition-colors"
                placeholder="••••••••"
                required
                data-testid="login-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2"
              data-testid="login-submit"
            >
              {loading ? <div className="spinner border-white border-t-transparent" /> : "Sign In"}
            </button>
          </form>
          
          <p className="text-sm text-zinc-600 mt-6 text-center">
            Don't have an account?{" "}
            <Link to="/register" className="text-[#002BF6] font-medium hover:underline" data-testid="goto-register">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
      <div className="hidden lg:block flex-1 bg-zinc-100 relative">
        <img 
          src="https://static.prod-images.emergentagent.com/jobs/2fef00ad-31a3-496b-8ffb-385a2c4a02aa/images/d8373a644321b84732aad05d0fbdfc5537bf7b6861fd8b798145300ba7887c61.png" 
          alt="Abstract" 
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    </div>
  );
};

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get("ref");

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, name, referralCode);
      if (referralCode) {
        toast.success("Welcome! You joined via referral - your friend got bonus generations!");
      }
      navigate("/dashboard");
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6 pt-24">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Create your account</h1>
          <p className="text-zinc-600 mb-8">Start generating amazing content in seconds.</p>
          
          {referralCode && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm mb-6 flex items-center gap-2" data-testid="referral-notice">
              <Gift size={18} /> You were invited by a friend!
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm mb-6" data-testid="register-error">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-zinc-300 focus:border-[#002BF6] focus:ring-2 focus:ring-[#002BF6]/20 outline-none transition-colors"
                placeholder="Your name"
                required
                data-testid="register-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-zinc-300 focus:border-[#002BF6] focus:ring-2 focus:ring-[#002BF6]/20 outline-none transition-colors"
                placeholder="you@example.com"
                required
                data-testid="register-email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-zinc-300 focus:border-[#002BF6] focus:ring-2 focus:ring-[#002BF6]/20 outline-none transition-colors"
                placeholder="At least 6 characters"
                required
                minLength={6}
                data-testid="register-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2"
              data-testid="register-submit"
            >
              {loading ? <div className="spinner border-white border-t-transparent" /> : "Create Account"}
            </button>
          </form>
          
          <p className="text-sm text-zinc-600 mt-6 text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-[#002BF6] font-medium hover:underline" data-testid="goto-login">
              Sign in
            </Link>
          </p>
        </div>
      </div>
      <div className="hidden lg:block flex-1 bg-zinc-100 relative">
        <img 
          src="https://static.prod-images.emergentagent.com/jobs/2fef00ad-31a3-496b-8ffb-385a2c4a02aa/images/d8373a644321b84732aad05d0fbdfc5537bf7b6861fd8b798145300ba7887c61.png" 
          alt="Abstract" 
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [usage, setUsage] = useState(null);
  const [history, setHistory] = useState([]);
  const [template, setTemplate] = useState("social_media");
  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState("English");
  const [tone, setTone] = useState("Professional");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [referralStats, setReferralStats] = useState(null);
  const [showReferral, setShowReferral] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const templates = [
    { id: "social_media", name: "Social Media", icon: ChatCircle },
    { id: "email", name: "Email", icon: EnvelopeSimple },
    { id: "blog", name: "Blog Post", icon: Article },
    { id: "product_description", name: "Product", icon: ShoppingBag }
  ];

  const languages = ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Romanian", "Dutch", "Polish", "Russian", "Chinese", "Japanese", "Korean", "Arabic", "Hindi"];
  const tones = ["Professional", "Casual", "Friendly", "Persuasive", "Humorous", "Formal", "Inspirational"];

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const paymentStatus = searchParams.get("payment");
    
    if (sessionId && paymentStatus === "success") {
      pollPaymentStatus(sessionId);
    }
    
    fetchUsage();
    fetchHistory();
    fetchReferralStats();
  }, [searchParams]);

  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    if (attempts >= 5) return;
    
    try {
      const { data } = await API.get(`/payments/status/${sessionId}`);
      if (data.payment_status === "paid") {
        toast.success("Payment successful! You're now Premium!");
        refreshUser();
        return;
      }
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), 2000);
    } catch (err) {
      console.error("Payment status error:", err);
    }
  };

  const fetchUsage = async () => {
    try {
      const { data } = await API.get("/generation/usage");
      setUsage(data);
    } catch (err) {
      console.error("Failed to fetch usage:", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data } = await API.get("/generation/history");
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  const fetchReferralStats = async () => {
    try {
      const { data } = await API.get("/auth/referral-stats");
      setReferralStats(data);
    } catch (err) {
      console.error("Failed to fetch referral stats:", err);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }
    
    setGenerating(true);
    setResult(null);
    
    try {
      const { data } = await API.post("/generation/generate", {
        template,
        prompt,
        language,
        tone
      });
      setResult(data);
      fetchUsage();
      fetchHistory();
      toast.success("Content generated!");
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (result?.content) {
      try {
        await navigator.clipboard.writeText(result.content);
        setCopied(true);
        toast.success("Copied to clipboard!");
      } catch (err) {
        // Fallback for environments without clipboard permissions
        const textArea = document.createElement("textarea");
        textArea.value = result.content;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand("copy");
          setCopied(true);
          toast.success("Copied to clipboard!");
        } catch (e) {
          toast.error("Failed to copy. Please select and copy manually.");
        }
        document.body.removeChild(textArea);
      }
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyReferralLink = async () => {
    if (referralStats?.referral_link) {
      try {
        await navigator.clipboard.writeText(referralStats.referral_link);
        setLinkCopied(true);
        toast.success("Referral link copied!");
      } catch (err) {
        const textArea = document.createElement("textarea");
        textArea.value = referralStats.referral_link;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand("copy");
          setLinkCopied(true);
          toast.success("Referral link copied!");
        } catch (e) {
          toast.error("Failed to copy");
        }
        document.body.removeChild(textArea);
      }
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const usagePercent = usage ? Math.min(100, (usage.today / (usage.daily_limit || 1)) * 100) : 0;
  const isLimitReached = usage && !usage.is_premium && usage.remaining === 0;

  return (
    <div className="min-h-screen bg-zinc-50">
      <Navbar />
      
      <main className="pt-20 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-zinc-600">Welcome back, {user?.name}</p>
            </div>
            
            {user?.is_premium ? (
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 text-sm font-medium" data-testid="premium-badge">
                <Crown size={18} /> Premium Member
              </span>
            ) : (
              <Link to="/pricing" className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2" data-testid="upgrade-btn">
                <Crown size={18} /> Upgrade to Premium
              </Link>
            )}
          </div>

          {/* Usage Card */}
          {usage && !usage.is_premium && (
            <div className="bg-white border border-zinc-200 p-6 mb-8" data-testid="usage-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Daily Usage</span>
                <span className="text-sm text-zinc-600">{usage.today} / {usage.daily_limit} generations</span>
              </div>
              <div className="h-2 bg-zinc-100 overflow-hidden">
                <div 
                  className={`h-full transition-all ${usagePercent >= 100 ? 'bg-red-500' : 'bg-[#002BF6]'}`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              {isLimitReached && (
                <p className="text-sm text-red-600 mt-2">
                  Daily limit reached. <Link to="/pricing" className="underline font-medium">Upgrade for unlimited</Link>
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Generator */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-zinc-200 p-6">
                <h2 className="font-bold text-lg mb-4">Generate Content</h2>
                
                {/* Templates */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Template</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTemplate(t.id)}
                        className={`p-4 border transition-all text-left ${
                          template === t.id 
                            ? 'border-[#002BF6] bg-[#002BF6]/5' 
                            : 'border-zinc-200 hover:border-zinc-300'
                        }`}
                        data-testid={`template-${t.id}`}
                      >
                        <t.icon size={20} className={template === t.id ? 'text-[#002BF6]' : 'text-zinc-600'} />
                        <span className="block text-sm font-medium mt-2">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Options */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Language</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full px-4 py-2.5 border border-zinc-300 focus:border-[#002BF6] outline-none bg-white"
                      data-testid="language-select"
                    >
                      {languages.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Tone</label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full px-4 py-2.5 border border-zinc-300 focus:border-[#002BF6] outline-none bg-white"
                      data-testid="tone-select"
                    >
                      {tones.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Prompt */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-1.5">Describe what you want</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="E.g., Write a compelling Instagram caption for a new coffee shop opening..."
                    className="w-full px-4 py-3 border border-zinc-300 focus:border-[#002BF6] outline-none resize-none h-32"
                    data-testid="prompt-input"
                  />
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || isLimitReached}
                  className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="generate-btn"
                >
                  {generating ? (
                    <>
                      <div className="spinner border-white border-t-transparent" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkle size={20} weight="fill" />
                      Generate Content
                    </>
                  )}
                </button>
              </div>

              {/* Result */}
              {result && (
                <div className="bg-white border border-zinc-200 p-6 animate-fade-in" data-testid="result-card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold">Generated Content</h3>
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm border border-zinc-200 hover:border-[#002BF6] transition-colors"
                      data-testid="copy-btn"
                    >
                      {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div className="prose prose-sm max-w-none" data-testid="result-content">
                    <p className="whitespace-pre-wrap text-zinc-700">{result.content}</p>
                  </div>
                </div>
              )}
            </div>

            {/* History Sidebar */}
            <div className="bg-white border border-zinc-200 p-6 h-fit">
              <h2 className="font-bold text-lg mb-4">Recent Generations</h2>
              {history.length === 0 ? (
                <p className="text-sm text-zinc-500">No generations yet. Create your first!</p>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {history.slice(0, 10).map((item) => (
                    <div 
                      key={item.id} 
                      className="border-b border-zinc-100 pb-4 last:border-0 cursor-pointer hover:bg-zinc-50 -mx-2 px-2 py-2 transition-colors"
                      onClick={() => {
                        setResult(item);
                        setTemplate(item.template);
                        setPrompt(item.prompt);
                      }}
                      data-testid={`history-${item.id}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-2 py-0.5 bg-zinc-100 uppercase">{item.template.replace("_", " ")}</span>
                      </div>
                      <p className="text-sm text-zinc-600 line-clamp-2">{item.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!user) {
      navigate("/register");
      return;
    }
    
    if (user.is_premium) {
      toast.info("You're already a Premium member!");
      return;
    }
    
    setLoading(true);
    try {
      const { data } = await API.post("/payments/create-checkout", {
        origin_url: window.location.origin
      });
      window.location.href = data.url;
    } catch (err) {
      toast.error(formatError(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">Simple, Transparent Pricing</h1>
            <p className="text-lg text-zinc-600">Start free, upgrade when you need more.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Free Plan */}
            <div className="bg-white border border-zinc-200 p-8" data-testid="free-plan">
              <h3 className="text-xl font-bold mb-2">Free</h3>
              <p className="text-zinc-600 text-sm mb-6">Perfect for trying out WriteGenius</p>
              <div className="text-4xl font-bold mb-6">
                €0 <span className="text-base font-normal text-zinc-500">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm">
                  <Check size={18} className="text-green-600" /> 5 generations per day
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check size={18} className="text-green-600" /> All templates
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check size={18} className="text-green-600" /> 50+ languages
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check size={18} className="text-green-600" /> Generation history
                </li>
              </ul>
              {!user ? (
                <Link to="/register" className="block w-full py-3 text-center font-semibold border border-zinc-300 hover:border-zinc-400 transition-colors" data-testid="free-cta">
                  Get Started
                </Link>
              ) : (
                <span className="block w-full py-3 text-center font-semibold bg-zinc-100 text-zinc-500">
                  Current Plan
                </span>
              )}
            </div>

            {/* Premium Plan */}
            <div className="bg-[#09090B] text-white border border-zinc-800 p-8 relative" data-testid="premium-plan">
              <span className="absolute top-4 right-4 px-3 py-1 bg-[#002BF6] text-xs font-semibold">POPULAR</span>
              <h3 className="text-xl font-bold mb-2">Premium</h3>
              <p className="text-zinc-400 text-sm mb-6">For creators who need more power</p>
              <div className="text-4xl font-bold mb-6">
                €8 <span className="text-base font-normal text-zinc-400">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm">
                  <Check size={18} className="text-[#002BF6]" /> Unlimited generations
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check size={18} className="text-[#002BF6]" /> All templates
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check size={18} className="text-[#002BF6]" /> 50+ languages
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check size={18} className="text-[#002BF6]" /> Priority support
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check size={18} className="text-[#002BF6]" /> Advanced tones
                </li>
              </ul>
              {user?.is_premium ? (
                <span className="block w-full py-3 text-center font-semibold bg-zinc-800 text-zinc-400">
                  Current Plan
                </span>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="w-full py-3 bg-[#002BF6] hover:bg-[#0021C7] font-semibold transition-colors flex items-center justify-center gap-2"
                  data-testid="premium-cta"
                >
                  {loading ? <div className="spinner border-white border-t-transparent" /> : (
                    <>
                      <Crown size={18} /> Upgrade Now
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// ==================== APP ====================

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
