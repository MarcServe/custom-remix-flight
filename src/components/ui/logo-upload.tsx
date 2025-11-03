import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, Image, X } from "lucide-react";

interface LogoUploadProps {
  currentLogoUrl?: string;
  onUploadSuccess: (url: string) => void;
}

export function LogoUpload({ currentLogoUrl, onUploadSuccess }: LogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentLogoUrl);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please select JPG, PNG, WEBP, or SVG",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Delete old logo if exists
      if (currentLogoUrl) {
        const oldPath = currentLogoUrl.split('/').slice(-2).join('/');
        await supabase.storage.from('email-branding').remove([oldPath]);
      }

      // Upload new logo
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/logo-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('email-branding')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('email-branding')
        .getPublicUrl(fileName);

      const publicUrl = data.publicUrl;

      // Update business profile with new logo URL
      const { error: updateError } = await supabase
        .from('business_profiles')
        .update({ email_logo_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setPreviewUrl(publicUrl);
      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });

      onUploadSuccess(publicUrl);
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (currentLogoUrl) {
        const oldPath = currentLogoUrl.split('/').slice(-2).join('/');
        await supabase.storage.from('email-branding').remove([oldPath]);
      }

      await supabase
        .from('business_profiles')
        .update({ email_logo_url: null })
        .eq('user_id', user.id);

      setPreviewUrl(undefined);
      onUploadSuccess('');
      
      toast({
        title: "Success",
        description: "Logo removed successfully",
      });
    } catch (error: any) {
      console.error('Error removing logo:', error);
      toast({
        title: "Error",
        description: "Failed to remove logo",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Label htmlFor="logo-upload">Company Logo</Label>
      
      {previewUrl ? (
        <div className="relative inline-block">
          <div className="flex items-center justify-center w-48 h-24 border rounded-lg bg-muted/50 p-2">
            <img
              src={previewUrl}
              alt="Company logo"
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-center w-48 h-24 border-2 border-dashed rounded-lg bg-muted/50">
          <Image className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Label htmlFor="logo-upload" className="cursor-pointer">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            asChild
          >
            <span>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {previewUrl ? 'Change Logo' : 'Upload Logo'}
                </>
              )}
            </span>
          </Button>
        </Label>
        <input
          id="logo-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />
      </div>
      
      <p className="text-xs text-muted-foreground">
        Recommended: 200x60px. JPG, PNG, WEBP, or SVG. Max 5MB.
      </p>
    </div>
  );
}
