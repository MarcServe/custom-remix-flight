import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Users, Send, CheckCircle, XCircle, Clock, Eye, Shield, Zap, FlaskConical } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EmailDeliverability from "./EmailDeliverability";
import AutomationRules from "./AutomationRules";
import ABTesting from "./ABTesting";

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  opened_count: number;
  failed_count: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface CampaignRecipient {
  id: string;
  email: string;
  name: string;
  status: string;
  sent_at?: string;
  opened_at?: string;
  error_message?: string;
}

export default function Campaigns() {
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['email-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Campaign[];
    },
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
  });

  const { data: recipients } = useQuery({
    queryKey: ['campaign-recipients', selectedCampaign],
    enabled: !!selectedCampaign,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_campaign_recipients')
        .select('*')
        .eq('campaign_id', selectedCampaign!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as CampaignRecipient[];
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      scheduled: "outline",
      sending: "default",
      completed: "default",
      failed: "destructive",
    };

    const icons = {
      draft: Clock,
      scheduled: Clock,
      sending: Send,
      completed: CheckCircle,
      failed: XCircle,
    };

    const Icon = icons[status as keyof typeof icons] || Mail;

    return (
      <Badge variant={variants[status] || "secondary"}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const getRecipientStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      sent: "default",
      failed: "destructive",
      opened: "default",
    };

    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
            <Mail className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Campaigns Hub</h1>
            <p className="text-sm text-muted-foreground">
              Manage your email campaigns, monitor health, and optimize performance
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setSearchParams({ tab: value })}>
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Email Health</span>
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Automation</span>
          </TabsTrigger>
          <TabsTrigger value="testing" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            <span className="hidden sm:inline">A/B Testing</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">

      {!campaigns || campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Create your first bulk email campaign from the People page by selecting multiple contacts
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Campaigns</CardTitle>
            <CardDescription>View performance and manage your campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => {
                  const progress = campaign.total_recipients > 0
                    ? (campaign.sent_count / campaign.total_recipients) * 100
                    : 0;

                  return (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {campaign.total_recipients}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2 min-w-[200px]">
                          <div className="flex justify-between text-xs">
                            <span>
                              {campaign.sent_count} sent
                              {campaign.opened_count > 0 && `, ${campaign.opened_count} opened`}
                            </span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                          {campaign.failed_count > 0 && (
                            <p className="text-xs text-destructive">
                              {campaign.failed_count} failed
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(campaign.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCampaign(campaign.id)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

        {/* Campaign Details Dialog */}
        <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Campaign Recipients</DialogTitle>
              <DialogDescription>
                View individual recipient status and details
              </DialogDescription>
            </DialogHeader>
            
            {recipients && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Opened At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map((recipient) => (
                    <TableRow key={recipient.id}>
                      <TableCell>{recipient.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {recipient.email}
                      </TableCell>
                      <TableCell>{getRecipientStatusBadge(recipient.status)}</TableCell>
                      <TableCell className="text-sm">
                        {recipient.sent_at
                          ? format(new Date(recipient.sent_at), 'MMM d, HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {recipient.opened_at
                          ? format(new Date(recipient.opened_at), 'MMM d, HH:mm')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>
        </TabsContent>

        <TabsContent value="health">
          <EmailDeliverability />
        </TabsContent>

        <TabsContent value="automation">
          <AutomationRules />
        </TabsContent>

        <TabsContent value="testing">
          <ABTesting />
        </TabsContent>
      </Tabs>
    </div>
  );
}