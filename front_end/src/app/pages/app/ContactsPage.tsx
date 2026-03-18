import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Search, Mail, Phone, Building, ExternalLink, Download } from "lucide-react";

export default function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const contacts = [
    {
      id: "1",
      name: "Ahmed Al-Mansouri",
      business: "TechCorp Industries",
      businessId: "1",
      email: "ahmed@techcorp.ae",
      phone: "+971 4 123 4567",
      role: "Sales Director",
      status: "verified"
    },
    {
      id: "2",
      name: "Contact - General",
      business: "Global Exports Ltd",
      businessId: "2",
      email: "contact@globalexports.com",
      phone: "+971 2 987 6543",
      role: "General Inquiry",
      status: "verified"
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-gray-600 mt-1">Centralized contact database across all businesses</p>
        </div>
        <Button>
          <Download className="mr-2 h-4 w-4" />
          Export Contacts
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>
                    <Link to={`/app/business/${contact.businessId}`} className="flex items-center gap-1 text-blue-600 hover:text-blue-700">
                      <Building className="h-3 w-3" />
                      {contact.business}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-sm">
                      <Mail className="h-3 w-3" />
                      {contact.email}
                    </a>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm">
                      <Phone className="h-3 w-3" />
                      {contact.phone}
                    </span>
                  </TableCell>
                  <TableCell><Badge variant="outline">{contact.role}</Badge></TableCell>
                  <TableCell><Badge className="bg-green-600">Verified</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <Mail className="h-4 w-4" />
                    </Button>
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
