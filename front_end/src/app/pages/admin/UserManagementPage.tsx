import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { UserPlus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../lib/api";

export default function UserManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [creditAmounts, setCreditAmounts] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await api.adminUsers();
      setUsers(data);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast.error("Failed to load users");
    }
  };

  const handleToggleActive = async (userId: number) => {
    try {
      await api.adminToggleActive(userId);
      toast.success("User status updated");
      fetchUsers();
    } catch (error) {
      console.error("Failed to toggle user:", error);
      toast.error("Failed to update user status");
    }
  };

  const handleAddCredits = async (userId: number) => {
    const amount = parseInt(creditAmounts[userId] || "0");
    if (amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    try {
      await api.adminManageCredits(userId, "add", amount);
      toast.success(`Added ${amount} credits`);
      setCreditAmounts({ ...creditAmounts, [userId]: "" });
      fetchUsers();
    } catch (error) {
      console.error("Failed to add credits:", error);
      toast.error("Failed to add credits");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-gray-600 mt-1">Manage workspace users and permissions</p>
        </div>
        <Button onClick={() => toast.success("Create user dialog would open")}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell><Badge variant={user.is_admin ? "default" : "secondary"}>{user.is_admin ? "Admin" : "User"}</Badge></TableCell>
                  <TableCell>{user.credits_remaining || 0}</TableCell>
                  <TableCell><Badge className={user.is_active ? "bg-green-600" : ""}>{user.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2 items-center">
                      <Input
                        type="number"
                        placeholder="Credits"
                        className="w-24"
                        value={creditAmounts[user.user_id] || ""}
                        onChange={(e) => setCreditAmounts({ ...creditAmounts, [user.user_id]: e.target.value })}
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleAddCredits(user.user_id)}
                      >
                        Add
                      </Button>
                      <Button 
                        variant={user.is_active ? "destructive" : "default"} 
                        size="sm"
                        onClick={() => handleToggleActive(user.user_id)}
                      >
                        {user.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
