import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, Image, X } from "lucide-react";

interface LogoUploadProps {
  currentLogoUrl?: string;
  onUploadSuccess: (url: string) => void;
  /** When false (e.g. sender profile), only upload to storage and call onUploadSuccess; do not update business_profiles. */
  updateBusinessProfile?: boolean;
}

export function LogoUpload({ currentLogoUrl, onUploadSuccess, updateBusinessProfile = true }: LogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentLogoUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

      // Delete old logo if exists (extract path after bucket name from URL)
      if (currentLogoUrl) {
        const parts = currentLogoUrl.split('/');
        const bucketIdx = parts.indexOf('email-branding');
        const oldPath = bucketIdx >= 0 ? parts.slice(bucketIdx + 1).join('/') : parts.slice(-2).join('/');
        await supabase.storage.from('email-branding').remove([oldPath]);
      }

      // Upload new logo (use different path for sender profiles so they don't overwrite main logo)
      const fileExt = file.name.split('.').pop();
      const fileName = updateBusinessProfile
        ? `${user.id}/logo-${Date.now()}.${fileExt}`
        : `${user.id}/sender-logos/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('email-branding')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('email-branding')
        .getPublicUrl(fileName);

      const publicUrl = data.publicUrl;

      // Update business profile only when used for main branding (not sender profiles)
      if (updateBusinessProfile) {
        const { error: updateError } = await supabase
          .from('business_profiles')
          .update({ email_logo_url: publicUrl })
          .eq('user_id', user.id);

        if (updateError) throw updateError;
      }

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
        const parts = currentLogoUrl.split('/');
        const bucketIdx = parts.indexOf('email-branding');
        const oldPath = bucketIdx >= 0 ? parts.slice(bucketIdx + 1).join('/') : parts.slice(-2).join('/');
        await supabase.storage.from('email-branding').remove([oldPath]);
      }

      if (updateBusinessProfile) {
        await supabase
          .from('business_profiles')
          .update({ email_logo_url: null })
          .eq('user_id', user.id);
      }

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
        <input
          ref={fileInputRef}
          id="logo-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          onChange={handleFileChange}
          className="sr-only"
          disabled={uploading}
          aria-label="Upload logo"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
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
        </Button>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Recommended: 200x60px. JPG, PNG, WEBP, or SVG. Max 5MB.
      </p>
    </div>
  );
}
