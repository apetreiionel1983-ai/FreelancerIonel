import { useState, useEffect, createContext, useContext, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useSearchParams, Link, useParams } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { 
  Book, 
  BookOpen,
  User,
  SignOut,
  House,
  MagnifyingGlass,
  ShoppingCart,
  Heart,
  Globe,
  CaretLeft,
  CaretRight,
  Play,
  Pause,
  SpeakerHigh,
  List,
  X,
  Plus,
  Pencil,
  Trash,
  ChartBar,
  Gift,
  Check,
  Copy,
  Eye,
  Download,
  Headphones
} from "@phosphor-icons/react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true
});

// Languages and Categories
const LANGUAGES = {
  "ro": { name: "Română", flag: "🇷🇴" },
  "en": { name: "English", flag: "🇬🇧" },
  "es": { name: "Español", flag: "🇪🇸" },
  "de": { name: "Deutsch", flag: "🇩🇪" },
  "it": { name: "Italiano", flag: "🇮🇹" },
  "fr": { name: "Français", flag: "🇫🇷" }
};

const CATEGORIES = {
  "fiction": { ro: "Ficțiune", en: "Fiction", icon: "📖" },
  "novella": { ro: "Nuvele", en: "Novellas", icon: "📑" },
  "poetry": { ro: "Poezii", en: "Poetry", icon: "🎭" }
};

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

  const register = async (email, password, name) => {
    const { data } = await API.post("/auth/register", { email, password, name });
    setUser(data);
    return data;
  };

  const logout = async () => {
    await API.post("/auth/logout");
    setUser(false);
  };

  const refreshUser = () => checkAuth();

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected Route
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  
  return children;
};

// Format Error
const formatError = (error) => {
  const detail = error.response?.data?.detail;
  if (!detail) return error.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  return String(detail);
};

// ==================== COMPONENTS ====================

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="glass fixed top-0 left-0 right-0 z-50 border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3" data-testid="logo">
          <Book size={32} weight="duotone" className="text-orange-500" />
          <span className="text-xl font-bold font-serif">FreelancerIonel</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/library" className="text-sm font-medium text-stone-600 hover:text-orange-500 transition-colors" data-testid="nav-library">
            Bibliotecă
          </Link>
          {user ? (
            <>
              <Link to="/my-books" className="text-sm font-medium text-stone-600 hover:text-orange-500 transition-colors" data-testid="nav-mybooks">
                Cărțile Mele
              </Link>
              {user.role === "admin" && (
                <Link to="/admin" className="text-sm font-medium text-stone-600 hover:text-orange-500 transition-colors" data-testid="nav-admin">
                  Admin
                </Link>
              )}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-stone-100 transition-colors"
                  data-testid="user-menu"
                >
                  <User size={20} />
                  <span className="text-sm font-medium">{user.name}</span>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-stone-200 py-2">
                    <button
                      onClick={() => { logout(); setMenuOpen(false); navigate("/"); }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      data-testid="logout-btn"
                    >
                      <SignOut size={18} /> Deconectare
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-stone-600 hover:text-orange-500 transition-colors" data-testid="nav-login">
                Conectare
              </Link>
              <Link to="/register" className="btn-primary px-5 py-2.5 rounded-lg text-sm" data-testid="nav-register">
                Înregistrare
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <List size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-stone-200 px-4 py-4 space-y-3">
          <Link to="/library" className="block py-2 text-sm font-medium" onClick={() => setMobileOpen(false)}>Bibliotecă</Link>
          {user ? (
            <>
              <Link to="/my-books" className="block py-2 text-sm font-medium" onClick={() => setMobileOpen(false)}>Cărțile Mele</Link>
              {user.role === "admin" && (
                <Link to="/admin" className="block py-2 text-sm font-medium" onClick={() => setMobileOpen(false)}>Admin</Link>
              )}
              <button onClick={() => { logout(); setMobileOpen(false); navigate("/"); }} className="block py-2 text-sm font-medium text-red-600">Deconectare</button>
            </>
          ) : (
            <>
              <Link to="/login" className="block py-2 text-sm font-medium" onClick={() => setMobileOpen(false)}>Conectare</Link>
              <Link to="/register" className="block py-2 text-sm font-medium text-orange-500" onClick={() => setMobileOpen(false)}>Înregistrare</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

const BookCard = ({ book }) => {
  const categoryClass = `category-${book.category}`;
  
  return (
    <Link to={`/book/${book._id}`} className="book-card bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100" data-testid={`book-${book._id}`}>
      <div className="aspect-[3/4] bg-gradient-to-br from-stone-100 to-stone-200 relative">
        {book.cover_url ? (
          <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Book size={64} className="text-stone-400" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="flag-emoji">{LANGUAGES[book.language]?.flag}</span>
        </div>
        {book.is_free && (
          <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            GRATUIT
          </div>
        )}
      </div>
      <div className="p-4">
        <span className={`category-badge ${categoryClass} mb-2 inline-block`}>
          {CATEGORIES[book.category]?.icon} {CATEGORIES[book.category]?.ro}
        </span>
        <h3 className="font-serif font-bold text-lg mb-1 line-clamp-2">{book.title}</h3>
        <p className="text-sm text-stone-500 line-clamp-2">{book.description}</p>
        <div className="mt-3 flex items-center justify-between">
          {book.is_free ? (
            <span className="text-green-600 font-semibold">Gratuit</span>
          ) : (
            <span className="text-orange-500 font-bold">€{book.price?.toFixed(2)}</span>
          )}
          <div className="flex items-center gap-1 text-stone-400 text-sm">
            <Eye size={16} /> {book.views || 0}
          </div>
        </div>
      </div>
    </Link>
  );
};

const AdBanner = ({ type = "horizontal" }) => (
  <div className={`ad-placeholder rounded-lg ${type === "horizontal" ? "h-24" : "h-64 w-full"}`}>
    <span>📢 Spațiu publicitar - Google AdSense</span>
  </div>
);

// ==================== PAGES ====================

const Home = () => {
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      const { data } = await API.get("/books/list");
      setBooks(data.books.slice(0, 6));
    } catch (err) {
      console.error("Failed to fetch books:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      
      {/* Hero */}
      <section className="pt-24 pb-16 px-4 sm:px-6 bg-gradient-to-b from-orange-50 to-white">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight mb-6 animate-fade-in">
            Bun venit la<br />
            <span className="text-orange-500">FreelancerIonel</span>
          </h1>
          <p className="text-lg sm:text-xl text-stone-600 max-w-2xl mx-auto mb-8 animate-fade-in">
            Descoperă cărți electronice în 6 limbi. Citește gratuit online sau cumpără pentru descărcare.
          </p>
          <div className="flex flex-wrap justify-center gap-4 animate-fade-in">
            <Link to="/library" className="btn-primary px-8 py-4 rounded-xl text-lg flex items-center gap-2" data-testid="hero-explore">
              <BookOpen size={24} /> Explorează Biblioteca
            </Link>
          </div>
          
          {/* Language Flags */}
          <div className="mt-12 flex justify-center gap-6 flex-wrap">
            {Object.entries(LANGUAGES).map(([code, lang]) => (
              <Link
                key={code}
                to={`/library?lang=${code}`}
                className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-white hover:shadow-lg transition-all"
                data-testid={`lang-${code}`}
              >
                <span className="text-4xl">{lang.flag}</span>
                <span className="text-sm font-medium text-stone-600">{lang.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Books */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl sm:text-3xl font-serif font-bold">Cărți Recente</h2>
            <Link to="/library" className="text-orange-500 font-medium hover:underline">
              Vezi toate →
            </Link>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="spinner" />
            </div>
          ) : books.length === 0 ? (
            <div className="text-center py-12 text-stone-500">
              <Book size={48} className="mx-auto mb-4 opacity-50" />
              <p>Nu există cărți încă. Revino curând!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
              {books.map((book) => (
                <BookCard key={book._id} book={book} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Ad Banner */}
      <section className="py-8 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <AdBanner type="horizontal" />
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 px-4 sm:px-6 bg-stone-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-center mb-12">Categorii</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <Link
                key={key}
                to={`/library?category=${key}`}
                className="bg-white rounded-2xl p-8 text-center shadow-sm hover:shadow-xl transition-all border border-stone-100"
                data-testid={`category-${key}`}
              >
                <span className="text-5xl mb-4 block">{cat.icon}</span>
                <h3 className="font-serif font-bold text-xl">{cat.ro}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Giveaway Banner */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl p-8 sm:p-12 text-white text-center">
          <Gift size={48} className="mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl font-serif font-bold mb-4">Tombolă cu Premii! 🎁</h2>
          <p className="text-lg opacity-90 mb-6">
            La <strong>500 de cumpărături</strong> - câștigă o <strong>Tabletă</strong> (€150)!<br />
            La <strong>1000 de cumpărături</strong> - abonamente gratuite!
          </p>
          <Link to="/giveaway" className="inline-block bg-white text-orange-500 font-bold px-8 py-3 rounded-xl hover:bg-orange-50 transition-colors">
            Află mai multe
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-8 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Book size={24} className="text-orange-500" />
              <span className="font-serif font-bold">FreelancerIonel</span>
            </div>
            <div className="flex gap-6 text-sm text-stone-500">
              <Link to="/terms" className="hover:text-orange-500">Termeni și Condiții</Link>
              <Link to="/privacy" className="hover:text-orange-500">Confidențialitate</Link>
              <Link to="/giveaway" className="hover:text-orange-500">Regulament Tombolă</Link>
            </div>
          </div>
          <p className="text-center text-sm text-stone-400 mt-6">
            © 2026 FreelancerIonel. Toate drepturile rezervate.
          </p>
        </div>
      </footer>
    </div>
  );
};

const Library = () => {
  const [searchParams] = useSearchParams();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLang, setSelectedLang] = useState(searchParams.get("lang") || "");
  const [selectedCat, setSelectedCat] = useState(searchParams.get("category") || "");

  useEffect(() => {
    fetchBooks();
  }, [selectedLang, selectedCat]);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      let url = "/books/list";
      const params = [];
      if (selectedLang) params.push(`language=${selectedLang}`);
      if (selectedCat) params.push(`category=${selectedCat}`);
      if (params.length) url += `?${params.join("&")}`;
      
      const { data } = await API.get(url);
      setBooks(data.books);
    } catch (err) {
      console.error("Failed to fetch books:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      
      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-8">Bibliotecă</h1>
          
          {/* Filters */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 mb-8 shadow-sm border border-stone-100">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-2">Limbă</label>
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-stone-200 bg-white min-w-[150px]"
                  data-testid="filter-language"
                >
                  <option value="">Toate limbile</option>
                  {Object.entries(LANGUAGES).map(([code, lang]) => (
                    <option key={code} value={code}>{lang.flag} {lang.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-2">Categorie</label>
                <select
                  value={selectedCat}
                  onChange={(e) => setSelectedCat(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-stone-200 bg-white min-w-[150px]"
                  data-testid="filter-category"
                >
                  <option value="">Toate categoriile</option>
                  {Object.entries(CATEGORIES).map(([key, cat]) => (
                    <option key={key} value={key}>{cat.icon} {cat.ro}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Books Grid */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="spinner" />
            </div>
          ) : books.length === 0 ? (
            <div className="text-center py-12 text-stone-500">
              <Book size={48} className="mx-auto mb-4 opacity-50" />
              <p>Nu au fost găsite cărți cu filtrele selectate.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
              {books.map((book) => (
                <BookCard key={book._id} book={book} />
              ))}
            </div>
          )}
          
          {/* Ad */}
          <div className="mt-12">
            <AdBanner type="horizontal" />
          </div>
        </div>
      </main>
    </div>
  );
};

const BookDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    fetchBook();
  }, [id]);

  const fetchBook = async () => {
    try {
      const { data } = await API.get(`/books/${id}`);
      setBook(data);
    } catch (err) {
      toast.error("Cartea nu a fost găsită");
      navigate("/library");
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    
    setPurchasing(true);
    try {
      const { data } = await API.post("/payments/purchase", {
        book_id: id,
        origin_url: window.location.origin
      });
      
      if (data.free) {
        toast.success("Cartea a fost adăugată în biblioteca ta!");
        refreshUser();
        fetchBook();
      } else if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!book) return null;

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      
      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-stone-600 hover:text-orange-500 mb-6">
            <CaretLeft size={20} /> Înapoi
          </button>
          
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-100">
            <div className="grid md:grid-cols-3 gap-8">
              {/* Cover */}
              <div className="aspect-[3/4] bg-gradient-to-br from-stone-100 to-stone-200 rounded-2xl overflow-hidden relative">
                {book.cover_url ? (
                  <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Book size={80} className="text-stone-400" />
                  </div>
                )}
              </div>
              
              {/* Info */}
              <div className="md:col-span-2">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flag-emoji text-2xl">{LANGUAGES[book.language]?.flag}</span>
                  <span className={`category-badge category-${book.category}`}>
                    {CATEGORIES[book.category]?.icon} {CATEGORIES[book.category]?.ro}
                  </span>
                </div>
                
                <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-4" data-testid="book-title">
                  {book.title}
                </h1>
                
                <p className="text-stone-600 mb-6">{book.description}</p>
                
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center gap-2 text-stone-500">
                    <Eye size={20} /> {book.views || 0} vizualizări
                  </div>
                  {book.has_audio && (
                    <div className="flex items-center gap-2 text-stone-500">
                      <Headphones size={20} /> Audio disponibil
                    </div>
                  )}
                </div>
                
                {/* Price & Actions */}
                <div className="bg-stone-50 rounded-xl p-6">
                  {book.is_free ? (
                    <p className="text-2xl font-bold text-green-600 mb-4">Gratuit</p>
                  ) : (
                    <p className="text-3xl font-bold text-orange-500 mb-4">€{book.price?.toFixed(2)}</p>
                  )}
                  
                  <div className="flex flex-wrap gap-3">
                    <Link
                      to={`/read/${id}`}
                      className="flex-1 btn-primary py-3 rounded-xl flex items-center justify-center gap-2"
                      data-testid="read-btn"
                    >
                      <BookOpen size={20} /> Citește Online {!book.owned && "(cu reclame)"}
                    </Link>
                    
                    {!book.owned && (
                      <button
                        onClick={handlePurchase}
                        disabled={purchasing}
                        className="flex-1 bg-stone-900 text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-stone-800 disabled:opacity-50"
                        data-testid="buy-btn"
                      >
                        {purchasing ? (
                          <div className="spinner border-white border-t-transparent" />
                        ) : (
                          <>
                            <ShoppingCart size={20} /> 
                            {book.is_free ? "Adaugă în bibliotecă" : "Cumpără"}
                          </>
                        )}
                      </button>
                    )}
                    
                    {book.owned && (
                      <span className="flex-1 bg-green-100 text-green-700 py-3 rounded-xl flex items-center justify-center gap-2 font-medium">
                        <Check size={20} /> Deții această carte
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Ad */}
          <div className="mt-8">
            <AdBanner type="horizontal" />
          </div>
        </div>
      </main>
    </div>
  );
};

const Reader = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchPage(1);
  }, [id]);

  const fetchPage = async (p) => {
    setLoading(true);
    try {
      const { data } = await API.get(`/books/${id}/read?page=${p}`);
      setData(data);
      setPage(data.current_page);
    } catch (err) {
      toast.error("Eroare la încărcarea cărții");
      navigate("/library");
    } finally {
      setLoading(false);
    }
  };

  const goToPage = (p) => {
    if (p >= 1 && p <= (data?.total_pages || 1)) {
      fetchPage(p);
      window.scrollTo(0, 0);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur border-b border-stone-200 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate(`/book/${id}`)} className="flex items-center gap-2 text-stone-600">
            <CaretLeft size={20} /> Înapoi
          </button>
          <h1 className="font-serif font-bold truncate max-w-[200px] sm:max-w-none">{data?.title}</h1>
          <span className="text-sm text-stone-500">{page} / {data?.total_pages}</span>
        </div>
      </div>

      {/* Reader Content */}
      <main className="pt-20 pb-24 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Ad at top if not owned */}
          {data?.show_ads && (
            <div className="mb-8">
              <AdBanner type="horizontal" />
            </div>
          )}
          
          {/* Content */}
          <div className="bg-white rounded-2xl p-6 sm:p-12 shadow-sm min-h-[60vh]">
            <div className="reader-content" data-testid="reader-content">
              {data?.content?.split('\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
          
          {/* Ad at bottom if not owned */}
          {data?.show_ads && (
            <div className="mt-8">
              <AdBanner type="horizontal" />
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-stone-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1 || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-100 disabled:opacity-50"
            data-testid="prev-page"
          >
            <CaretLeft size={20} /> Anterior
          </button>
          
          <span className="text-sm font-medium">Pagina {page} din {data?.total_pages}</span>
          
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= data?.total_pages || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white disabled:opacity-50"
            data-testid="next-page"
          >
            Următor <CaretRight size={20} />
          </button>
        </div>
      </div>
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
    if (user) navigate("/");
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <Book size={32} className="text-orange-500" />
          <span className="text-2xl font-serif font-bold">FreelancerIonel</span>
        </Link>
        
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100">
          <h1 className="text-2xl font-serif font-bold mb-6 text-center">Conectare</h1>
          
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4" data-testid="login-error">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                required
                data-testid="login-email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Parolă</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                required
                data-testid="login-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 rounded-lg flex items-center justify-center"
              data-testid="login-submit"
            >
              {loading ? <div className="spinner border-white border-t-transparent" /> : "Conectare"}
            </button>
          </form>
          
          <p className="text-center text-sm text-stone-500 mt-6">
            Nu ai cont? <Link to="/register" className="text-orange-500 font-medium">Înregistrează-te</Link>
          </p>
        </div>
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

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, name);
      navigate("/");
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <Book size={32} className="text-orange-500" />
          <span className="text-2xl font-serif font-bold">FreelancerIonel</span>
        </Link>
        
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100">
          <h1 className="text-2xl font-serif font-bold mb-6 text-center">Înregistrare</h1>
          
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4" data-testid="register-error">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nume</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                required
                data-testid="register-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                required
                data-testid="register-email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Parolă</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                required
                minLength={6}
                data-testid="register-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 rounded-lg flex items-center justify-center"
              data-testid="register-submit"
            >
              {loading ? <div className="spinner border-white border-t-transparent" /> : "Creează cont"}
            </button>
          </form>
          
          <p className="text-center text-sm text-stone-500 mt-6">
            Ai deja cont? <Link to="/login" className="text-orange-500 font-medium">Conectează-te</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

const MyBooks = () => {
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyBooks();
  }, [user]);

  const fetchMyBooks = async () => {
    if (!user?.purchased_books?.length) {
      setBooks([]);
      setLoading(false);
      return;
    }
    
    try {
      const { data } = await API.get("/books/list");
      const myBooks = data.books.filter(b => user.purchased_books.includes(b._id));
      setBooks(myBooks);
    } catch (err) {
      console.error("Failed to fetch books:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      
      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-serif font-bold mb-8">Cărțile Mele</h1>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="spinner" />
            </div>
          ) : books.length === 0 ? (
            <div className="text-center py-16">
              <Book size={64} className="mx-auto mb-4 text-stone-300" />
              <h2 className="text-xl font-medium text-stone-600 mb-2">Nu ai cărți încă</h2>
              <p className="text-stone-500 mb-6">Explorează biblioteca și adaugă cărți!</p>
              <Link to="/library" className="btn-primary px-6 py-3 rounded-lg inline-flex items-center gap-2">
                <BookOpen size={20} /> Explorează Biblioteca
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {books.map((book) => (
                <BookCard key={book._id} book={book} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const Admin = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddBook, setShowAddBook] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    language: "ro",
    category: "fiction",
    price: 0,
    is_free: true,
    content: "",
    cover_url: "",
    book_file: null
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadMethod, setUploadMethod] = useState("text"); // "text" or "file"

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, booksRes] = await Promise.all([
        API.get("/admin/stats"),
        API.get("/admin/books")
      ]);
      setStats(statsRes.data);
      setBooks(booksRes.data.books);
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBook = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const form = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === "book_file" && value) {
          form.append("book_file", value);
        } else if (key !== "book_file") {
          form.append(key, value);
        }
      });
      
      await API.post("/admin/books", form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      toast.success("Cartea a fost adăugată!");
      setShowAddBook(false);
      setFormData({
        title: "",
        description: "",
        language: "ro",
        category: "fiction",
        price: 0,
        is_free: true,
        content: "",
        cover_url: "",
        book_file: null,
        auto_translate: false
      });
      setUploadMethod("text");
      fetchData();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBook = async (bookId) => {
    if (!window.confirm("Ești sigur că vrei să ștergi această carte?")) return;
    
    try {
      await API.delete(`/admin/books/${bookId}`);
      toast.success("Cartea a fost ștearsă!");
      fetchData();
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      
      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-serif font-bold">Panou Admin</h1>
            <button
              onClick={() => setShowAddBook(true)}
              className="btn-primary px-6 py-3 rounded-lg flex items-center gap-2"
              data-testid="add-book-btn"
            >
              <Plus size={20} /> Adaugă Carte
            </button>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-6 border border-stone-100">
              <p className="text-sm text-stone-500 mb-1">Total Cărți</p>
              <p className="text-3xl font-bold">{stats?.total_books || 0}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-stone-100">
              <p className="text-sm text-stone-500 mb-1">Total Utilizatori</p>
              <p className="text-3xl font-bold">{stats?.total_users || 0}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-stone-100">
              <p className="text-sm text-stone-500 mb-1">Total Vânzări</p>
              <p className="text-3xl font-bold">{stats?.total_sales || 0}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-stone-100">
              <p className="text-sm text-stone-500 mb-1">Venit Total</p>
              <p className="text-3xl font-bold text-green-600">€{(stats?.total_revenue || 0).toFixed(2)}</p>
            </div>
          </div>
          
          {/* Books Table */}
          <div className="bg-white rounded-xl border border-stone-100 overflow-hidden">
            <div className="p-4 border-b border-stone-100">
              <h2 className="font-bold">Cărți ({books.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium">Titlu</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Limbă</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Categorie</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Preț</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Vizualizări</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Vânzări</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {books.map((book) => (
                    <tr key={book._id} className="border-t border-stone-100">
                      <td className="px-4 py-3 font-medium">{book.title}</td>
                      <td className="px-4 py-3">{LANGUAGES[book.language]?.flag} {LANGUAGES[book.language]?.name}</td>
                      <td className="px-4 py-3">{CATEGORIES[book.category]?.ro}</td>
                      <td className="px-4 py-3">{book.is_free ? "Gratuit" : `€${book.price}`}</td>
                      <td className="px-4 py-3">{book.views || 0}</td>
                      <td className="px-4 py-3">{book.sales || 0}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteBook(book._id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      
      {/* Add Book Modal */}
      {showAddBook && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Adaugă Carte Nouă</h2>
              <button onClick={() => setShowAddBook(false)}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleAddBook} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Titlu</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-stone-200"
                  required
                  data-testid="book-title-input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Descriere</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-stone-200 h-24"
                  required
                  data-testid="book-description-input"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Limbă</label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({...formData, language: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-stone-200"
                    data-testid="book-language-select"
                  >
                    {Object.entries(LANGUAGES).map(([code, lang]) => (
                      <option key={code} value={code}>{lang.flag} {lang.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Categorie</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-stone-200"
                    data-testid="book-category-select"
                  >
                    {Object.entries(CATEGORIES).map(([key, cat]) => (
                      <option key={key} value={key}>{cat.icon} {cat.ro}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Preț (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                    className="w-full px-4 py-2 rounded-lg border border-stone-200"
                    data-testid="book-price-input"
                  />
                </div>
                
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_free}
                      onChange={(e) => setFormData({...formData, is_free: e.target.checked})}
                      className="w-5 h-5 rounded"
                      data-testid="book-free-checkbox"
                    />
                    <span className="text-sm font-medium">Carte gratuită</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">URL Copertă (opțional)</label>
                <input
                  type="url"
                  value={formData.cover_url}
                  onChange={(e) => setFormData({...formData, cover_url: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-stone-200"
                  placeholder="https://..."
                  data-testid="book-cover-input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Metodă Încărcare Conținut</label>
                <div className="flex gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={uploadMethod === "text"}
                      onChange={() => setUploadMethod("text")}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">📝 Lipește Text</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={uploadMethod === "file"}
                      onChange={() => setUploadMethod("file")}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">📄 Upload PDF/EPUB</span>
                  </label>
                </div>
                
                {uploadMethod === "text" ? (
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-stone-200 h-48 font-mono text-sm"
                    placeholder="Lipește conținutul cărții aici..."
                    data-testid="book-content-input"
                  />
                ) : (
                  <div>
                    <input
                      type="file"
                      accept=".pdf,.epub"
                      onChange={(e) => setFormData({...formData, book_file: e.target.files[0]})}
                      className="w-full px-4 py-2 rounded-lg border border-stone-200"
                      data-testid="book-file-input"
                    />
                    {formData.book_file && (
                      <p className="text-sm text-green-600 mt-2">
                        ✅ {formData.book_file.name} ({(formData.book_file.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                    <p className="text-xs text-stone-500 mt-2">
                      Acceptă doar fișiere PDF și EPUB. Textul va fi extras automat.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.auto_translate}
                    onChange={(e) => setFormData({...formData, auto_translate: e.target.checked})}
                    className="w-5 h-5 rounded"
                    data-testid="auto-translate-checkbox"
                  />
                  <div>
                    <span className="font-medium text-orange-800">🤖 Traducere Automată AI</span>
                    <p className="text-xs text-orange-600 mt-1">
                      Creează automat versiuni în celelalte 5 limbi (EN, ES, DE, IT, FR)
                    </p>
                  </div>
                </label>
              </div>

              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddBook(false)}
                  className="flex-1 px-4 py-3 rounded-lg border border-stone-200 font-medium"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 btn-primary py-3 rounded-lg flex items-center justify-center"
                  data-testid="submit-book-btn"
                >
                  {submitting ? <div className="spinner border-white border-t-transparent" /> : "Adaugă Carte"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const Giveaway = () => {
  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      
      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-stone-100">
            <div className="text-center mb-8">
              <Gift size={64} className="mx-auto text-orange-500 mb-4" />
              <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-4">Regulament Tombolă</h1>
            </div>
            
            <div className="prose max-w-none">
              <h2>🎁 Premii</h2>
              <h3>La 500 de cumpărături:</h3>
              <ul>
                <li><strong>1x Tabletă</strong> (valoare aprox. €150) - prin extragere aleatorie</li>
              </ul>
              
              <h3>La 1000 de cumpărături:</h3>
              <ul>
                <li><strong>Locul 1:</strong> Abonament gratuit 1 AN</li>
                <li><strong>Locul 2:</strong> Abonament gratuit 6 LUNI</li>
                <li><strong>Locul 3:</strong> Abonament gratuit 3 LUNI</li>
              </ul>
              
              <h2>📋 Condiții de participare</h2>
              <ol>
                <li>Participanții trebuie să aibă cont pe FreelancerIonel.com</li>
                <li>Fiecare cumpărare = 1 șansă la extragere</li>
                <li>Extragerea se face aleatoriu, public</li>
                <li>Câștigătorii vor fi notificați prin email</li>
              </ol>
              
              <h2>⚖️ Aspecte Legale</h2>
              <p>
                Această tombolă respectă legislația în vigoare privind concursurile promoționale.
                Organizatorul își rezervă dreptul de a modifica regulamentul cu notificare prealabilă.
              </p>
              
              <h2>📞 Contact</h2>
              <p>
                Pentru întrebări: <a href="mailto:contact@freelancerionel.com">contact@freelancerionel.com</a>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const Terms = () => (
  <div className="min-h-screen bg-stone-50">
    <Navbar />
    <main className="pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl p-8 shadow-sm">
        <h1 className="text-3xl font-serif font-bold mb-6">Termeni și Condiții</h1>
        <div className="prose">
          <h2>1. Acceptarea Termenilor</h2>
          <p>Prin utilizarea site-ului FreelancerIonel.com, acceptați acești termeni.</p>
          
          <h2>2. Servicii</h2>
          <p>Oferim cărți electronice pentru citire online și descărcare.</p>
          
          <h2>3. Conturi</h2>
          <p>Sunteți responsabil pentru securitatea contului dumneavoastră.</p>
          
          <h2>4. Plăți</h2>
          <p>Plățile sunt procesate securizat prin Stripe.</p>
          
          <h2>5. Drepturi de Autor</h2>
          <p>Conținutul este protejat de drepturi de autor. Nu aveți dreptul să redistribuiți cărțile.</p>
        </div>
      </div>
    </main>
  </div>
);

const Privacy = () => (
  <div className="min-h-screen bg-stone-50">
    <Navbar />
    <main className="pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl p-8 shadow-sm">
        <h1 className="text-3xl font-serif font-bold mb-6">Politica de Confidențialitate</h1>
        <div className="prose">
          <h2>1. Date Colectate</h2>
          <p>Colectăm: nume, email, istoric cumpărături.</p>
          
          <h2>2. Utilizarea Datelor</h2>
          <p>Datele sunt folosite pentru funcționarea serviciului și comunicare.</p>
          
          <h2>3. Cookies</h2>
          <p>Folosim cookies pentru autentificare și preferințe.</p>
          
          <h2>4. GDPR</h2>
          <p>Respectăm Regulamentul General privind Protecția Datelor (GDPR).</p>
          
          <h2>5. Contact</h2>
          <p>Pentru ștergerea datelor: contact@freelancerionel.com</p>
        </div>
      </div>
    </main>
  </div>
);

// ==================== APP ====================

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/library" element={<Library />} />
          <Route path="/book/:id" element={<BookDetail />} />
          <Route path="/read/:id" element={<Reader />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/giveaway" element={<Giveaway />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/my-books" element={
            <ProtectedRoute>
              <MyBooks />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute adminOnly>
              <Admin />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
