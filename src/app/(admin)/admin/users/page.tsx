"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Users,
  Search,
  Shield,
  User as UserIcon,
  ShoppingBag,
  MapPin,
  Calendar,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle,
  X,
} from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card } from "@/components/ui/card"
import { formatPrice, formatDate } from "@/lib/utils"
import { toast } from "sonner"

interface Address {
  id: string
  line1: string
  city: string
  state: string
  postalCode: string
  country: string
}

interface UserItem {
  id: string
  email: string
  firstName: string
  lastName: string
  role: "ADMIN" | "CUSTOMER"
  addressCount: number
  defaultAddress: Address | null
  orderCount: number
  totalSpend: number // in cents/paise
  createdAt: string
  updatedAt: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")

  // Add User Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formEmail, setFormEmail] = useState("")
  const [formFirstName, setFormFirstName] = useState("")
  const [formLastName, setFormLastName] = useState("")
  const [formRole, setFormRole] = useState<"CUSTOMER" | "ADMIN">("CUSTOMER")
  const [saving, setSaving] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/users")
      const data = await res.json()
      if (data.success) {
        setUsers(data.users)
      } else {
        toast.error("Failed to load users from database")
      }
    } catch {
      toast.error("Network error while loading users")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase())
    const matchesRole = !roleFilter || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  // Toggle user role
  const handleToggleRole = async (user: UserItem) => {
    const newRole = user.role === "ADMIN" ? "CUSTOMER" : "ADMIN"
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Updated ${user.email} to ${newRole}`)
        loadUsers()
      } else {
        toast.error("Failed to update user role")
      }
    } catch {
      toast.error("Error updating user role")
    }
  }

  // Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formEmail.trim() || !formFirstName.trim()) {
      toast.error("Please provide email and first name")
      return
    }

    try {
      setSaving(true)
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formEmail.trim(),
          firstName: formFirstName.trim(),
          lastName: formLastName.trim(),
          role: formRole,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Created user "${formEmail}"`)
        setIsModalOpen(false)
        setFormEmail("")
        setFormFirstName("")
        setFormLastName("")
        loadUsers()
      } else {
        toast.error(data.error || "Failed to create user")
      }
    } catch {
      toast.error("Error creating user")
    } finally {
      setSaving(false)
    }
  }

  // Delete User
  const handleDeleteUser = async (u: UserItem) => {
    if (!confirm(`Are you sure you want to delete user ${u.email}?`)) return
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        toast.success("User deleted")
        loadUsers()
      } else {
        toast.error(data.error || "Failed to delete user")
      }
    } catch {
      toast.error("Error deleting user")
    }
  }

  // Metrics
  const totalUsers = users.length
  const adminCount = users.filter((u) => u.role === "ADMIN").length
  const customerCount = users.filter((u) => u.role === "CUSTOMER").length
  const totalLTV = users.reduce((sum, u) => sum + u.totalSpend, 0)

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-black/10 pb-5">
        <PageHeader
          title="User & Customer Management"
          description="Manage customer accounts, roles, addresses, and track lifetime customer value in Neon PostgreSQL."
        />

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white p-2.5 text-xs font-semibold text-black hover:bg-[#F0EEED] transition-colors cursor-pointer"
            title="Refresh database"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-black py-2.5 px-5 text-xs font-bold text-white shadow-xs hover:bg-black/85 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="rounded-2xl border-black/10 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-black/60">Registered Accounts</span>
          <p className="text-xl font-black text-black mt-1 tabular-nums">{totalUsers}</p>
        </Card>
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-900">Customers</span>
          <p className="text-xl font-black text-emerald-900 mt-1 tabular-nums">{customerCount}</p>
        </Card>
        <Card className="rounded-2xl border-purple-200 bg-purple-50/50 p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-purple-900">Administrators</span>
          <p className="text-xl font-black text-purple-900 mt-1 tabular-nums">{adminCount}</p>
        </Card>
        <Card className="rounded-2xl border-black bg-black text-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-white/70">Total Customer LTV</span>
          <p className="text-xl font-black text-white mt-1 tabular-nums">{formatPrice(totalLTV)}</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-black/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name or email..."
            className="w-full rounded-full bg-white border border-black/10 pl-10 pr-4 py-2.5 text-xs font-medium text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black shadow-2xs"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-full bg-white border border-black/10 px-4 py-2.5 text-xs font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black cursor-pointer shadow-2xs w-full sm:w-auto"
        >
          <option value="">All Roles</option>
          <option value="CUSTOMER">Customers Only</option>
          <option value="ADMIN">Admins Only</option>
        </select>
      </div>

      {/* Users Table */}
      <Card className="rounded-[20px] border-black/10 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead>
              <tr className="border-b border-black/10 bg-[#F0EEED]/40 text-black/60 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 pl-6">Customer / Account</th>
                <th className="py-3.5">Role</th>
                <th className="py-3.5 text-center">Orders Placed</th>
                <th className="py-3.5 text-right">Lifetime Spend</th>
                <th className="py-3.5">Default Address</th>
                <th className="py-3.5">Joined Date</th>
                <th className="py-3.5 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-black/50">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="size-4 animate-spin" />
                      <span>Loading accounts from Neon PostgreSQL...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-black/50">
                    <p className="font-semibold text-sm">No users found</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F0EEED]/30 transition-colors">
                    {/* Customer Name & Email */}
                    <td className="py-3.5 pl-6">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-full bg-black text-white font-bold flex items-center justify-center text-xs shrink-0">
                          {u.firstName?.[0] || u.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-black text-xs">
                            {u.firstName} {u.lastName}
                          </p>
                          <p className="text-[11px] text-black/60">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role Badge with quick toggle */}
                    <td className="py-3.5">
                      <button
                        type="button"
                        onClick={() => handleToggleRole(u)}
                        title="Click to toggle between Admin and Customer"
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold cursor-pointer transition-all hover:scale-105 ${
                          u.role === "ADMIN"
                            ? "bg-purple-100 text-purple-900 border border-purple-200"
                            : "bg-black/5 text-black/80 hover:bg-black/10"
                        }`}
                      >
                        {u.role === "ADMIN" ? (
                          <>
                            <Shield className="size-3 text-purple-700" />
                            <span>ADMIN</span>
                          </>
                        ) : (
                          <>
                            <UserIcon className="size-3 text-black/50" />
                            <span>CUSTOMER</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Orders Placed */}
                    <td className="py-3.5 text-center font-bold text-black tabular-nums">
                      {u.orderCount}
                    </td>

                    {/* Lifetime Value */}
                    <td className="py-3.5 text-right font-bold text-black tabular-nums">
                      {formatPrice(u.totalSpend)}
                    </td>

                    {/* Default Address */}
                    <td className="py-3.5 text-[11px] text-black/70">
                      {u.defaultAddress ? (
                        <div className="flex items-center gap-1 max-w-[200px] truncate">
                          <MapPin className="size-3 text-black/40 shrink-0" />
                          <span className="truncate">
                            {u.defaultAddress.city}, {u.defaultAddress.state}
                          </span>
                        </div>
                      ) : (
                        <span className="text-black/30">None saved</span>
                      )}
                    </td>

                    {/* Joined Date */}
                    <td className="py-3.5 text-[11px] text-black/60 tabular-nums">
                      {formatDate(u.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 pr-6 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u)}
                        title="Delete user account"
                        className="p-1.5 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── ADD USER MODAL ─────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-[24px] border border-black/10 bg-white p-4 sm:p-7 shadow-2xl text-left max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-black/10 pb-3 mb-5">
              <h3 className="font-bold text-base text-black">Create User Account</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1.5 text-black/60 hover:bg-[#F0EEED] transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2.5 text-xs text-black font-medium focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    placeholder="Jane"
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs text-black font-medium focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    placeholder="Smith"
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs text-black font-medium focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">Account Role</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as "CUSTOMER" | "ADMIN")}
                  className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2.5 text-xs text-black font-semibold focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                >
                  <option value="CUSTOMER">Customer (Standard shopper)</option>
                  <option value="ADMIN">Administrator (Full cockpit access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full border border-black/10 py-2 px-4 text-xs font-semibold text-black hover:bg-[#F0EEED] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-black py-2 px-5 text-xs font-bold text-white hover:bg-black/85 disabled:opacity-50 active:scale-95 transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  {saving && <RefreshCw className="size-3 animate-spin" />}
                  <span>Save to Database</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

