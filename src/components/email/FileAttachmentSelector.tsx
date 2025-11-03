import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Paperclip, Upload, X, File, FileText, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FileAttachment {
  id?: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  isNewUpload?: boolean;
}

interface FileAttachmentSelectorProps {
  selectedFiles: FileAttachment[];
  onFilesChange: (files: FileAttachment[]) => void;
  disabled?: boolean;
}

export function FileAttachmentSelector({
  selectedFiles,
  onFilesChange,
  disabled = false,
}: FileAttachmentSelectorProps) {
  const [open, setOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedExistingIds, setSelectedExistingIds] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: existingFiles, isLoading } = useQuery({
    queryKey: ["crm-files-for-email"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_files")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleUploadFile = async () => {
    if (!uploadFile) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('crm-files')
        .upload(fileName, uploadFile);

      if (uploadError) throw uploadError;

      // Add to selected files
      const newAttachment: FileAttachment = {
        file_name: uploadFile.name,
        file_type: uploadFile.type,
        file_size: uploadFile.size,
        storage_path: fileName,
        isNewUpload: true,
      };

      onFilesChange([...selectedFiles, newAttachment]);
      setUploadFile(null);
      
      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    }
  };

  const handleSelectExisting = () => {
    const filesToAdd = existingFiles?.filter(f => 
      selectedExistingIds.includes(f.id) && 
      !selectedFiles.some(sf => sf.id === f.id)
    ) || [];
    
    onFilesChange([...selectedFiles, ...filesToAdd]);
    setSelectedExistingIds([]);
    setOpen(false);
  };

  const removeFile = (index: number) => {
    onFilesChange(selectedFiles.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    if (fileType.includes('pdf')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Attachments</Label>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
            >
              <Paperclip className="h-4 w-4 mr-2" />
              Add Files
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Attach Files</DialogTitle>
              <DialogDescription>
                Upload new files or select from existing files
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="existing" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing">Existing Files</TabsTrigger>
                <TabsTrigger value="upload">Upload New</TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="space-y-4">
                <ScrollArea className="h-[400px] pr-4">
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading files...
                    </div>
                  ) : existingFiles && existingFiles.length > 0 ? (
                    <div className="space-y-2">
                      {existingFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selectedExistingIds.includes(file.id)}
                            onCheckedChange={(checked) => {
                              setSelectedExistingIds(
                                checked
                                  ? [...selectedExistingIds, file.id]
                                  : selectedExistingIds.filter(id => id !== file.id)
                              );
                            }}
                            disabled={selectedFiles.some(sf => sf.id === file.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {getFileIcon(file.file_type)}
                              <p className="text-sm font-medium truncate">
                                {file.file_name}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.file_size)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No files available. Upload files in the Files section.
                    </div>
                  )}
                </ScrollArea>
                <div className="flex justify-end">
                  <Button
                    onClick={handleSelectExisting}
                    disabled={selectedExistingIds.length === 0}
                  >
                    Add Selected ({selectedExistingIds.length})
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="upload" className="space-y-4">
                <div className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <Input
                      type="file"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="max-w-xs mx-auto"
                    />
                    {uploadFile && (
                      <div className="mt-4">
                        <p className="text-sm font-medium">{uploadFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(uploadFile.size)}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={handleUploadFile}
                      disabled={!uploadFile}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload & Attach
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-2 rounded-lg border p-3">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-2 rounded bg-muted p-2"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {getFileIcon(file.file_type)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {file.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.file_size)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
