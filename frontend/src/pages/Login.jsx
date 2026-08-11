import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { GraduationCap, ShieldCheck, Building2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  // If already authenticated, bounce to appropriate landing page
  useEffect(() => {
    if (!authLoading && user) {
      const dest = user.role === 'parent' ? '/parent' : '/';
      nav(dest, { replace: true });
    }
  }, [user, authLoading, nav]);

  const submit = async (e) => {
    e.preventDefault();
    const value = (identifier || '').trim();
    if (!value || !password) {
      toast.error('Please enter your email or mobile number and password');
      return;
    }
    setLoading(true);
    try {
      const u = await login(value, password);
      toast.success(`Welcome, ${u.full_name}`);
      const dest = u.role === 'parent' ? '/parent' : (loc.state?.from?.pathname || '/');
      nav(dest, { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      const status = err.response?.status;
      if (status === 401) toast.error(detail || 'Invalid credentials');
      else if (status === 403) toast.error(detail || 'Account is inactive');
      else if (!err.response) toast.error('Cannot reach server. Check your connection.');
      else toast.error(detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* left panel */}
      <div className="login-band relative hidden lg:flex flex-col justify-between p-10">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-[hsl(var(--primary))] flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="h-font font-semibold text-foreground">The Stanvard Sec. School</div>
            <div className="text-xs text-muted-foreground">School ERP &amp; Parent Portal</div>
          </div>
        </div>
        <div>
          <h1 className="h-font text-3xl xl:text-4xl font-semibold text-foreground max-w-md leading-tight">
            Excellence in education, powered by modern school management.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-md">
            Manage students, fees, attendance, and communication across the school from a single, secure platform.
          </p>
          <div className="mt-8 grid gap-2">
            {[
              { icon: ShieldCheck, t: 'Secure payments & audit-ready records' },
              { icon: Building2, t: 'Kanpur (Girwa), Udaipur · 0294-2493312' },
              { icon: CreditCard, t: 'Cash, UPI, Card, Cheque, Bank Transfer, Online' },
            ].map((f) => (
              <div key={f.t} className="flex items-center gap-2 text-sm text-foreground/80">
                <f.icon className="h-4 w-4 text-[hsl(var(--accent))]" />
                <span>{f.t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} The Stanvard Sec. School. All rights reserved.</div>
      </div>
      {/* form */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6 sm:p-8 border-border shadow-sm">
          <div className="mb-6 text-center lg:hidden">
            <div className="inline-flex h-10 w-10 rounded-md bg-[hsl(var(--primary))] items-center justify-center mb-2">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div className="h-font font-semibold">The Stanvard Sec. School</div>
          </div>
          <h2 className="h-font text-2xl font-semibold">Welcome back</h2>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account to continue.</p>

          <form onSubmit={submit} className="mt-6 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="identifier">Email or Mobile Number</Label>
              <Input
                id="identifier" type="text" required autoFocus
                autoComplete="username"
                data-testid="login-email-input"
                value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@stanvard.school or 10-digit mobile"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Parents: sign in with your registered mobile number.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password" type="password" required
                autoComplete="current-password"
                data-testid="login-password-input"
                value={password} onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Parents: your password is the last 6 digits of your mobile number.
              </p>
            </div>
            <Button data-testid="login-submit-button" type="submit" disabled={loading || !identifier || !password} className="h-10">
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
