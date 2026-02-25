import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const contactSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100, "First name must be less than 100 characters"),
  last_name: z.string().min(1, "Last name is required").max(100, "Last name must be less than 100 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phone: z.string().max(50, "Phone must be less than 50 characters").optional(),
  title: z.string().max(200, "Title must be less than 200 characters").optional(),
  company_id: z.string().uuid().optional().nullable(),
  company_name: z.string().max(200, "Company name must be less than 200 characters").optional(),
  linkedin_url: z.string().url("Invalid URL").optional().or(z.literal('')),
  twitter_url: z.string().url("Invalid URL").optional().or(z.literal('')),
  location: z.string().max(200, "Location must be less than 200 characters").optional(),
  bio: z.string().max(1000, "Bio must be less than 1000 characters").optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialValues?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    title?: string;
    company_id?: string | null;
    company_name?: string;
    linkedin_url?: string;
  };
}

export function AddContactDialog({ open, onOpenChange, onSuccess, initialValues }: AddContactDialogProps) {
  const { toast } = useToast();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      title: "",
      company_id: null,
      company_name: "",
      linkedin_url: "",
      twitter_url: "",
      location: "",
      bio: "",
    },
  });

  // Reset form when dialog opens with new initial values
  useEffect(() => {
    if (open) {
      const values = initialValues ? {
        first_name: initialValues.first_name || "",
        last_name: initialValues.last_name || "",
        email: initialValues.email || "",
        phone: initialValues.phone || "",
        title: initialValues.title || "",
        company_id: initialValues.company_id || null,
        company_name: initialValues.company_name || "",
        linkedin_url: initialValues.linkedin_url || "",
        twitter_url: "",
        location: "",
        bio: "",
      } : {
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        title: "",
        company_id: null,
        company_name: "",
        linkedin_url: "",
        twitter_url: "",
        location: "",
        bio: "",
      };
      
      form.reset(values, { keepDefaultValues: false });
    }
  }, [open, initialValues, form]);

  // Fetch companies for dropdown
  const { data: companies } = useQuery({
    queryKey: ["companies-for-contact"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Create contact mutation with intelligent duplicate handling
  const createContact = useMutation({
    mutationFn: async (values: ContactFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Intelligent duplicate check: check by email (case-insensitive) if email provided
      if (values.email && values.email.trim()) {
        const { data: existingPerson } = await supabase
          .from("people")
          .select("id, email, first_name, last_name, company_id")
          .ilike("email", values.email.trim())
          .maybeSingle();

        if (existingPerson) {
          // Update existing contact with new information if provided
          const updates: any = {};
          let hasUpdates = false;

          if (values.first_name && values.first_name.trim() && !existingPerson.first_name) {
            updates.first_name = values.first_name.trim();
            hasUpdates = true;
          }
          if (values.last_name && values.last_name.trim() && !existingPerson.last_name) {
            updates.last_name = values.last_name.trim();
            hasUpdates = true;
          }
          if (values.phone && !existingPerson.phone) {
            updates.phone = values.phone;
            hasUpdates = true;
          }
          if (values.title && !existingPerson.title) {
            updates.title = values.title;
            hasUpdates = true;
          }
          if (values.linkedin_url && !existingPerson.linkedin_url) {
            updates.linkedin_url = values.linkedin_url;
            hasUpdates = true;
          }

          // Handle company
          let finalCompanyId = values.company_id;
          if (values.company_name && !values.company_id) {
            const nameTrimmed = values.company_name.trim();
            const { data: existingRows } = await supabase
              .from("companies")
              .select("id")
              .eq("user_id", user.id)
              .ilike("name", nameTrimmed)
              .limit(1);
            const existingCompany = existingRows?.[0];
            if (existingCompany) {
              finalCompanyId = existingCompany.id;
            } else {
              const { data: newCompany, error: companyError } = await supabase
                .from("companies")
                .insert({
                  user_id: user.id,
                  name: nameTrimmed,
                })
                .select()
                .single();

              if (companyError) {
                throw new Error(companyError.message || "Failed to create company");
              }
              finalCompanyId = newCompany.id;
            }
          }

          if (finalCompanyId && existingPerson.company_id !== finalCompanyId) {
            updates.company_id = finalCompanyId;
            hasUpdates = true;
          }

          if (hasUpdates) {
            const { data: updatedPerson, error: updateError } = await supabase
              .from("people")
              .update(updates)
              .eq("id", existingPerson.id)
              .select()
              .single();

            if (updateError) {
              throw new Error(updateError.message || "Failed to update contact");
            }
            return { ...updatedPerson, wasExisting: true };
          }

          return { ...existingPerson, wasExisting: true };
        }
      }

      let finalCompanyId = values.company_id;

      // If user entered a company name manually, reuse existing company by name or create
      if (values.company_name && !values.company_id) {
        const nameTrimmed = values.company_name.trim();
        const { data: existingRows } = await supabase
          .from("companies")
          .select("id")
          .eq("user_id", user.id)
          .ilike("name", nameTrimmed)
          .limit(1);
        const existingCompany = existingRows?.[0];
        if (existingCompany) {
          finalCompanyId = existingCompany.id;
        } else {
          const { data: newCompany, error: companyError } = await supabase
            .from("companies")
            .insert({
              user_id: user.id,
              name: nameTrimmed,
            })
            .select()
            .single();

          if (companyError) {
            throw new Error(companyError.message || "Failed to create company");
          }
          finalCompanyId = newCompany.id;
        }
      }

      const { data, error } = await supabase
        .from("people")
        .insert({
          user_id: user.id,
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email || null,
          phone: values.phone || null,
          title: values.title || null,
          company_id: finalCompanyId || null,
          linkedin_url: values.linkedin_url || null,
          twitter_url: values.twitter_url || null,
          location: values.location || null,
          bio: values.bio || null,
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message || "Database error");
      }
      return { ...data, wasExisting: false };
    },
    onSuccess: (data: any) => {
      toast({
        title: data.wasExisting ? "Contact updated" : "Contact created",
        description: data.wasExisting 
          ? "Contact already existed and has been updated with new information"
          : "Contact has been added successfully",
      });
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : typeof (error as { message?: string })?.message === "string"
            ? (error as { message: string }).message
            : "Unknown error";
      toast({
        title: "Failed to create contact",
        description: message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ContactFormData) => {
    createContact.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Contact</DialogTitle>
          <DialogDescription>
            Manually add a new contact to your CRM
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 234 567 8900" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title/Position</FormLabel>
                    <FormControl>
                      <Input placeholder="VP of Sales" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter company name" 
                        {...field}
                        disabled={!!form.watch("company_id")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="company_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Or Select Existing Company</FormLabel>
                  <Select 
                    value={field.value || undefined} 
                    onValueChange={(value) => {
                      field.onChange(value || null);
                      if (value) {
                        form.setValue("company_name", "");
                      }
                    }}
                    disabled={!!form.watch("company_name")}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select from existing companies" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {companies?.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="linkedin_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LinkedIn URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://linkedin.com/in/johndoe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="twitter_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Twitter URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://twitter.com/johndoe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="San Francisco, CA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio/Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional information about this contact..." 
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createContact.isPending}>
                {createContact.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Contact
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
