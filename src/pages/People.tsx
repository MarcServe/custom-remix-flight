import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Phone, Briefcase, Linkedin } from "lucide-react";

export default function People() {
  const { data: people, isLoading } = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const { data } = await supabase
        .from("people")
        .select("*, companies(name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">People</h1>
        <p className="text-muted-foreground">Your contact directory</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {people?.map((person) => (
          <Card key={person.id} className="transition-all hover:shadow-md">
            <CardHeader>
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {person.first_name?.[0]}
                    {person.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <CardTitle className="text-lg">
                    {person.first_name} {person.last_name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{person.title}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {person.companies?.name && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  {person.companies.name}
                </div>
              )}
              {person.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`mailto:${person.email}`}
                    className="text-primary hover:underline"
                  >
                    {person.email}
                  </a>
                </div>
              )}
              {person.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  {person.phone}
                </div>
              )}
              {person.linkedin_url && (
                <a
                  href={person.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Linkedin className="h-4 w-4" />
                  LinkedIn Profile
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
