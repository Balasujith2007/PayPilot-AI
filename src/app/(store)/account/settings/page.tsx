"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useAuthStore } from "@/store/auth"
import { toast } from "sonner"
import type { User } from "@/types"

function ProfileForm({
  user,
  onSave,
}: {
  user: User
  onSave: (data: Partial<Pick<User, "firstName" | "lastName" | "email">>) => void
}) {
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const [email, setEmail] = useState(user.email)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    onSave({ firstName, lastName, email })
    toast.success("Profile updated")
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit">Save Changes</Button>
    </form>
  )
}

export default function SettingsPage() {
  const { user, isReady } = useAuthGuard()
  const updateProfile = useAuthStore((s) => s.updateProfile)

  if (!isReady || !user) return null

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <PageHeader title="Settings" />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm user={user} onSave={updateProfile} />
        </CardContent>
      </Card>

      <Separator className="my-8" />

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); toast.success("Password updated (demo)") }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input id="currentPassword" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input id="newPassword" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input id="confirmPassword" type="password" />
            </div>
            <Button type="submit">Update Password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
