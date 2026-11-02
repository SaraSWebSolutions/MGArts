import { useState } from "react";
import { UserRound, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { authApi } from "../../services/endpoints";
import { getErrorMessage, pickToken, pickUser } from "../../services/api";
import { useAuth } from "../../context/authContext";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ userId: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const next = {};
    if (!form.userId.trim()) next.userId = "User ID is required";
    if (!form.password) next.password = "Password is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const { data } = await authApi.login({
        userId: form.userId.trim(),
        password: form.password,
      });

      const token = pickToken(data);
      if (!token) throw new Error("Login response did not include a token");

      await login(token, pickUser(data));
      toast.success("Welcome back!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err, "Invalid user ID or password"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left panel - 70% */}
      <div className="hidden lg:flex lg:w-[70%] lg:min-h-screen items-center justify-center overflow-hidden bg-brand p-0">
        <img
          src="/assets/login-hero.jpg"
          alt="MG Arts"
          className="h-full w-full object-cover"
        />
      </div>

      {/* Right panel - 30% */}
      <div className="w-full lg:w-[30%] flex items-center justify-center px-6 sm:px-10 py-12 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile brand mark */}
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <img
              src="/assets/logo-horizontal.jpg"
              alt="MG Arts"
              className="h-12 w-auto object-contain"
            />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            Welcome back
          </h2>
          <p className="text-sm text-slate-500 mb-8">
            Enter your credentials to sign in to your account.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {/* User ID */}
            <div className="mb-5">
              <label
                htmlFor="userId"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                User ID
              </label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                <input
                  id="userId"
                  type="text"
                  autoComplete="username"
                  placeholder="Enter your user ID"
                  value={form.userId}
                  onChange={handleChange("userId")}
                  className={`w-full pl-10 pr-3 py-2.5 rounded-lg border text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:ring-2 focus:ring-brand/20 focus:border-brand ${
                    errors.userId ? "border-red-400" : "border-slate-200"
                  }`}
                />
              </div>
              {errors.userId && (
                <p className="mt-1.5 text-xs text-red-500">{errors.userId}</p>
              )}
            </div>

            {/* Password */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange("password")}
                  className={`w-full pl-10 pr-10 py-2.5 rounded-lg border text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:ring-2 focus:ring-brand/20 focus:border-brand ${
                    errors.password ? "border-red-400" : "border-slate-200"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4.5 w-4.5" />
                  ) : (
                    <Eye className="h-4.5 w-4.5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-500">{errors.password}</p>
              )}
            </div>

            <div className="mb-6" />

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-brand-dark active:bg-brand-dark transition disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#e79d19de" }}
            >
              {submitting ? (
                "Signing in..."
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
