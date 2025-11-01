import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SendEmailDialog } from "@/components/SendEmailDialog";
import { 
  User, Mail, Phone, Briefcase, MapPin, 
  Linkedin, Twitter, Calendar, Pencil, Trash2, Send
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Person {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  title?: string;
  bio?: string;
  location?: string;
  linkedin_url?: string;
  twitter_url?: string;
  created_at?: string;
  enriched_at?: string;
  company_id?: string;
}

interface PersonDetailsDialogProps {
  person: Person;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export function PersonDetailsDialog({
  person,
  open,
  onOpenChange,
  onUpdate,
}: PersonDetailsDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(person);
  const [loading, setLoading] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Only include fields that exist in the people table
      const updateData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        title: formData.title,
        bio: formData.bio,
        location: formData.location,
        linkedin_url: formData.linkedin_url,
        twitter_url: formData.twitter_url,
      };

      const { error } = await supabase
        .from("people")
        .update(updateData)
        .eq("id", person.id);

      if (error) throw error;

      toast.success("Person updated successfully");
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error("Error updating person:", error);
      toast.error("Failed to update person");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this person?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("people")
        .delete()
        .eq("id", person.id);

      if (error) throw error;

      toast.success("Person deleted successfully");
      onOpenChange(false);
      onUpdate?.();
    } catch (error) {
      console.error("Error deleting person:", error);
      toast.error("Failed to delete person");
    } finally {
      setLoading(false);
    }
  };

  const fullName = `${person.first_name || ""} ${person.last_name || ""}`.trim() || "Unknown";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-2xl">{fullName}</DialogTitle>
                {person.title && (
                  <DialogDescription className="text-base">
                    {person.title}
                  </DialogDescription>
                )}
              </div>
            </div>
            {!isEditing && (
              <div className="flex gap-2">
                {person.email && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setEmailDialogOpen(true)}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Send Email
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, first_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, last_name: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Job Title</Label>
                  <Input
                    id="title"
                    value={formData.title || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, bio: e.target.value })
                    }
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setFormData(person);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={loading}>
                    {loading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {person.email && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <a
                      href={`mailto:${person.email}`}
                      className="text-primary hover:underline"
                    >
                      {person.email}
                    </a>
                  </div>
                )}

                {person.phone && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <a
                      href={`tel:${person.phone}`}
                      className="text-primary hover:underline"
                    >
                      {person.phone}
                    </a>
                  </div>
                )}

                {person.title && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                    <span>{person.title}</span>
                  </div>
                )}

                {person.location && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <span>{person.location}</span>
                  </div>
                )}

                {person.bio && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Bio</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{person.bio}</p>
                    </CardContent>
                  </Card>
                )}

                <div className="flex gap-2">
                  {person.linkedin_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={person.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Linkedin className="h-4 w-4 mr-2" />
                        LinkedIn
                      </a>
                    </Button>
                  )}
                  {person.twitter_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={person.twitter_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Twitter className="h-4 w-4 mr-2" />
                        Twitter
                      </a>
                    </Button>
                  )}
                </div>

                {person.created_at && (
                  <div className="pt-4 border-t text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      Added {format(new Date(person.created_at), "MMM dd, yyyy")}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">
                  Activity history coming soon
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {person.email && (
        <SendEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          recipientEmail={person.email}
          recipientName={fullName}
          companyId={person.company_id}
          contactId={person.id}
        />
      )}
    </Dialog>
  );
}
