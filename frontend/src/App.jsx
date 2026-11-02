import { Routes, Route, Navigate } from "react-router-dom";
import PublicRoute from "./utils/publicRoute";
import PrivateRoute from "./utils/privateRoute";
import { Toaster } from "react-hot-toast";
import Login from "./pages/commonPages/Login";
import MainLayout from "./layout/MainLayout";
import ClientDashboard from "./pages/client/Dashboard";
import Stock from "./pages/client/Stock";
import Jewellery from "./pages/client/Jewellery";
import GoldReceipts from "./pages/client/GoldReceipts";
import Conversions from "./pages/client/Conversions";
import Purchases from "./pages/client/Purchases";
import JobWork from "./pages/client/JobWork";
import Billing from "./pages/client/Billing";
import Sales from "./pages/client/Sales";
import Customers from "./pages/client/Customers";
import Workers from "./pages/client/Workers";
import TaxRates from "./pages/client/TaxRates";
import Reports from "./pages/client/Reports";
import Settings from "./pages/client/Settings";
import Users from "./pages/client/Users";
import Roles from "./pages/client/Roles";
import Permissions from "./pages/client/Permissions";
import Profile from "./pages/client/Profile";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }
        >
          <Route path="/dashboard" element={<ClientDashboard />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/jewellery" element={<Jewellery />} />
          <Route path="/gold-receipts" element={<GoldReceipts />} />
          <Route path="/conversions" element={<Conversions />} />
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/jobs" element={<JobWork />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/workers" element={<Workers />} />
          <Route path="/tax-rates" element={<TaxRates />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/users" element={<Users />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/permissions" element={<Permissions />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster position="top-right" reverseOrder={false} duration={2000} />
    </>
  );
}

export default App;
