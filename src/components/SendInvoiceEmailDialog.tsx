import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, Send } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { FileAttachmentSelector } from "./email/FileAttachmentSelector";

interface SendInvoiceEmailDialogProps {
  invoice: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SendInvoiceEmailDialog({
  invoice,
  open,
  onOpenChange,
}: SendInvoiceEmailDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [recipientType, setRecipientType] = useState<"company" | "contact">("company");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedContact, setSelectedContact] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [context, setContext] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch companies
  const { data: companies } = useQuery({
    queryKey: ["companies-for-invoice"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, general_email")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch contacts
  const { data: contacts } = useQuery({
    queryKey: ["contacts-for-invoice"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, email, company_id, companies(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Set default values when invoice changes
  useEffect(() => {
    if (invoice && open) {
      setSubject(`${invoice.invoice_type === 'invoice' ? 'Invoice' : 'Quotation'} ${invoice.invoice_number}`);
      
      // Pre-select company if linked to invoice
      if (invoice.company_id) {
        setRecipientType("company");
        setSelectedCompany(invoice.company_id);
      }
    }
  }, [invoice, open]);

  // Generate AI email
  const generateEmail = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      const { data, error } = await supabase.functions.invoke("generate-email-with-ai", {
        body: {
          context: {
            invoiceNumber: invoice.invoice_number,
            invoiceType: invoice.invoice_type,
            companyName: invoice.companies?.name || "valued customer",
            amount: invoice.total_amount,
            dueDate: format(new Date(invoice.due_date), "MMMM d, yyyy"),
            lineItems: invoice.line_items?.map((item: any) => item.description).join(", "),
          },
          type: invoice.invoice_type === 'invoice' ? 'invoice' : 'quotation',
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.subject) setSubject(data.subject);
      if (data.body) setBody(data.body);
      toast({
        title: "Email generated",
        description: "AI has generated the email content for you",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to generate email",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsGenerating(false);
    },
  });

  // Send email
  const sendEmail = useMutation({
    mutationFn: async () => {
      let recipientEmail = customEmail;

      if (recipientType === "company" && selectedCompany) {
        const company = companies?.find(c => c.id === selectedCompany);
        recipientEmail = company?.general_email || "";
      } else if (recipientType === "contact" && selectedContact) {
        const contact = contacts?.find(c => c.id === selectedContact);
        recipientEmail = contact?.email || "";
      }

      if (!recipientEmail) {
        throw new Error("Please select a recipient or enter an email address");
      }

      // Create invoice HTML/PDF attachment content
      const invoiceHtml = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
              h1 { color: #333; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
              .total { font-size: 1.2em; font-weight: bold; }
            </style>
          </head>
          <body>
            <h1>${invoice.invoice_type === 'invoice' ? 'Invoice' : 'Quotation'} ${invoice.invoice_number}</h1>
            <p><strong>Date:</strong> ${format(new Date(invoice.issue_date), "MMM d, yyyy")}</p>
            <p><strong>Due Date:</strong> ${format(new Date(invoice.due_date), "MMM d, yyyy")}</p>
            ${invoice.companies ? `<p><strong>To:</strong> ${invoice.companies.name}</p>` : ''}
            
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.line_items?.map((item: any) => `
                  <tr>
                    <td>${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>$${Number(item.unitPrice).toFixed(2)}</td>
                    <td>$${Number(item.total).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div style="margin-top: 20px; text-align: right;">
              <p>Subtotal: $${Number(invoice.subtotal).toFixed(2)}</p>
              <p>Tax (${invoice.tax_rate}%): $${Number(invoice.tax_amount).toFixed(2)}</p>
              <p class="total">Total: $${Number(invoice.total_amount).toFixed(2)}</p>
            </div>
            
            ${invoice.notes ? `<p style="margin-top: 20px;"><strong>Notes:</strong><br/>${invoice.notes}</p>` : ''}
            ${invoice.terms ? `<p style="margin-top: 20px;"><strong>Terms:</strong><br/>${invoice.terms}</p>` : ''}
          </body>
        </html>
      `;

      // Combine body with context if provided
      const finalBody = context ? `${body}\n\n---\nAdditional Notes:\n${context}` : body;

      // Get recipient name for the email
      let recipientName = "Valued Customer";
      if (recipientType === "company" && selectedCompany) {
        const company = companies?.find(c => c.id === selectedCompany);
        recipientName = company?.name || recipientName;
      } else if (recipientType === "contact" && selectedContact) {
        const contact = contacts?.find(c => c.id === selectedContact);
        recipientName = contact?.name || recipientName;
      }

      const { data, error } = await supabase.functions.invoke("send-crm-email", {
        body: {
          toEmail: recipientEmail,
          toName: recipientName,
          subject,
          bodyText: finalBody,
          bodyHtml: `<p>${finalBody.replace(/\n/g, '</p><p>')}</p>`,
          invoiceHtml,
          invoiceNumber: invoice.invoice_number,
          attachInvoice: true,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Email sent",
        description: `${invoice.invoice_type === 'invoice' ? 'Invoice' : 'Quotation'} sent successfully`,
      });
      onOpenChange(false);
      
      // Update invoice status to 'sent'
      supabase
        .from("invoices")
        .update({ status: "sent" })
        .eq("id", invoice.id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["invoices"] });
        });
    },
    onError: (error) => {
      toast({
        title: "Failed to send email",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!subject || !body) {
      toast({
        title: "Missing information",
        description: "Please fill in subject and body",
        variant: "destructive",
      });
      return;
    }
    sendEmail.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Send {invoice?.invoice_type === 'invoice' ? 'Invoice' : 'Quotation'} via Email</DialogTitle>
          <DialogDescription>
            Send {invoice?.invoice_number} to a company or contact
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto px-1">
          <div className="space-y-4 pr-4">
          {/* Recipient Selection */}
          <div className="grid gap-2">
            <Label>Recipient Type</Label>
            <Select value={recipientType} onValueChange={(value: "company" | "contact") => setRecipientType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Company</SelectItem>
                <SelectItem value="contact">Contact</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {recipientType === "company" && (
            <div className="grid gap-2">
              <Label>Select Company</Label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name} {company.general_email && `(${company.general_email})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {recipientType === "contact" && (
            <div className="grid gap-2">
              <Label>Select Contact</Label>
              <Select value={selectedContact} onValueChange={setSelectedContact}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts?.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name} - {contact.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Or Enter Email Address</Label>
            <Input
              type="email"
              placeholder="recipient@example.com"
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
            />
          </div>

          {/* Email Content */}
          <div className="flex items-center justify-between">
            <Label>Email Content</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateEmail.mutate()}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate with AI
            </Button>
          </div>

          <div className="grid gap-2">
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          <div className="grid gap-2">
            <Label>Body</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Email body..."
              className="min-h-[200px] max-h-[200px] overflow-y-auto"
            />
          </div>

          <div className="grid gap-2">
            <Label>Additional Context/Notes (Optional)</Label>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Add any additional context or special instructions..."
              rows={3}
            />
          </div>

          <FileAttachmentSelector
            selectedFiles={attachments}
            onFilesChange={setAttachments}
            disabled={sendEmail.isPending || isGenerating}
          />

          <p className="text-xs text-muted-foreground">
            The {invoice?.invoice_type === 'invoice' ? 'invoice' : 'quotation'} will be attached as an HTML document
          </p>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sendEmail.isPending}>
            {sendEmail.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
