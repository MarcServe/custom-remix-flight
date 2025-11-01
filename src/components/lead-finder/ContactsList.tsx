import { useState } from "react";
import { ChevronDown, ChevronUp, Mail, Phone, Linkedin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Contact {
  name: string;
  email?: string;
  emailVerified?: boolean;
  title?: string;
  department?: string;
  phone?: string;
  linkedinUrl?: string;
  isPrimary?: boolean;
}

interface ContactsListProps {
  contacts: Contact[];
  className?: string;
}

export function ContactsList({ contacts, className }: ContactsListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!contacts || contacts.length === 0) {
    return null;
  }

  const primaryContact = contacts.find(c => c.isPrimary) || contacts[0];
  const additionalContacts = contacts.filter(c => c !== primaryContact);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Primary Contact - Always Visible */}
      <div className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-foreground truncate">
              {primaryContact.name}
            </p>
            {primaryContact.isPrimary && (
              <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
            )}
          </div>
          {primaryContact.title && (
            <p className="text-xs text-muted-foreground truncate">
              {primaryContact.title}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {primaryContact.email && (
              <a
                href={`mailto:${primaryContact.email}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Mail className="h-2.5 w-2.5" />
                {primaryContact.email}
              </a>
            )}
            {primaryContact.phone && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-2.5 w-2.5" />
                {primaryContact.phone}
              </span>
            )}
            {primaryContact.linkedinUrl && (
              <a
                href={primaryContact.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <Linkedin className="h-2.5 w-2.5" />
                Profile
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Additional Contacts - Expandable */}
      {additionalContacts.length > 0 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="h-6 w-full text-xs justify-between px-2"
          >
            <span>
              {isExpanded ? 'Hide' : 'Show'} {additionalContacts.length} more {additionalContacts.length === 1 ? 'contact' : 'contacts'}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>

          {isExpanded && (
            <div className="space-y-1.5 animate-in slide-in-from-top-2">
              {additionalContacts.map((contact, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-md bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {contact.name}
                    </p>
                    {contact.title && (
                      <p className="text-xs text-muted-foreground truncate">
                        {contact.title}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Mail className="h-2.5 w-2.5" />
                          {contact.email}
                        </a>
                      )}
                      {contact.phone && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-2.5 w-2.5" />
                          {contact.phone}
                        </span>
                      )}
                      {contact.linkedinUrl && (
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <Linkedin className="h-2.5 w-2.5" />
                          Profile
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
