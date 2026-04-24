import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Progress } from "../../components/ui/progress";
import { CreditCard, Download } from "lucide-react";

export default function BillingPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription and usage</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Current Plan</CardTitle>
              <Badge className="bg-blue-600">Professional</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">$149/month</div>
                <div className="text-sm text-gray-600">Billed monthly • Next billing: April 15, 2026</div>
              </div>
              <Button variant="outline">Change Plan</Button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Searches this month</span>
                  <span className="font-medium">47 / Unlimited</span>
                </div>
                <Progress value={0} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>AI Relevancy Checks</span>
                  <span className="font-medium">1,234 / 2,000</span>
                </div>
                <Progress value={62} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Verifications</span>
                  <span className="font-medium">287 / 500</span>
                </div>
                <Progress value={57} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Email Sends</span>
                  <span className="font-medium">156 / 300</span>
                </div>
                <Progress value={52} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium">•••• 4242</div>
                <div className="text-xs text-muted-foreground">Expires 12/26</div>
              </div>
            </div>
            <Button variant="outline" className="w-full">Update Payment</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Billing History</CardTitle>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Download All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { date: "Mar 15, 2026", amount: "$149.00", status: "Paid" },
              { date: "Feb 15, 2026", amount: "$149.00", status: "Paid" },
              { date: "Jan 15, 2026", amount: "$149.00", status: "Paid" }
            ].map((invoice, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <div className="font-medium">{invoice.date}</div>
                  <div className="text-sm text-muted-foreground">{invoice.amount}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-green-600">{invoice.status}</Badge>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
