import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Mail, Eye, MousePointerClick, Reply, AlertTriangle, TrendingUp } from 'lucide-react';

interface CampaignAnalyticsProps {
  totalSent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  unsubscribed?: number;
}

export function CampaignAnalytics({
  totalSent,
  opened,
  clicked,
  replied,
  bounced,
  unsubscribed = 0,
}: CampaignAnalyticsProps) {
  const openRate = totalSent > 0 ? (opened / totalSent) * 100 : 0;
  const clickRate = totalSent > 0 ? (clicked / totalSent) * 100 : 0;
  const replyRate = totalSent > 0 ? (replied / totalSent) * 100 : 0;
  const bounceRate = totalSent > 0 ? (bounced / totalSent) * 100 : 0;

  const getHealthStatus = () => {
    if (bounceRate > 5) return { color: 'destructive', label: 'Poor' };
    if (bounceRate > 2) return { color: 'warning', label: 'Fair' };
    if (openRate > 30 && replyRate > 5) return { color: 'default', label: 'Excellent' };
    if (openRate > 20) return { color: 'secondary', label: 'Good' };
    return { color: 'secondary', label: 'Average' };
  };

  const health = getHealthStatus();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Campaign Health</h3>
          <p className="text-sm text-muted-foreground">Overall engagement metrics</p>
        </div>
        <Badge variant={health.color as any}>{health.label}</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Sent */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <CardDescription>Sent</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalSent}</p>
          </CardContent>
        </Card>

        {/* Open Rate */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" />
              <CardDescription>Opened</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{opened}</p>
            <div className="mt-2">
              <Progress value={openRate} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{openRate.toFixed(1)}% rate</p>
            </div>
          </CardContent>
        </Card>

        {/* Click Rate */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-purple-500" />
              <CardDescription>Clicked</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{clicked}</p>
            <div className="mt-2">
              <Progress value={clickRate} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{clickRate.toFixed(1)}% rate</p>
            </div>
          </CardContent>
        </Card>

        {/* Reply Rate */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Reply className="h-4 w-4 text-green-500" />
              <CardDescription>Replied</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{replied}</p>
            <div className="mt-2">
              <Progress value={replyRate} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{replyRate.toFixed(1)}% rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warning indicators */}
      {(bounced > 0 || unsubscribed > 0) && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <CardTitle className="text-sm">Deliverability Issues</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {bounced > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bounced emails</span>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">{bounced}</Badge>
                  <span className="text-xs text-muted-foreground">({bounceRate.toFixed(1)}%)</span>
                </div>
              </div>
            )}
            {unsubscribed > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Unsubscribed</span>
                <Badge variant="secondary">{unsubscribed}</Badge>
              </div>
            )}
            {bounceRate > 2 && (
              <p className="text-xs text-muted-foreground mt-2">
                ⚠️ High bounce rate detected. Review your email list quality and sending reputation.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Engagement insights */}
      <Card className="bg-muted/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <CardTitle className="text-sm">Engagement Insights</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {openRate < 15 && (
            <p className="text-muted-foreground">
              📉 Low open rate. Consider improving subject lines or sender reputation.
            </p>
          )}
          {openRate > 30 && (
            <p className="text-muted-foreground">
              ✨ Great open rate! Your subject lines are working well.
            </p>
          )}
          {clicked > 0 && clickRate < 5 && (
            <p className="text-muted-foreground">
              💡 Few clicks. Add clearer calls-to-action in your emails.
            </p>
          )}
          {replyRate > 5 && (
            <p className="text-muted-foreground">
              🎉 Excellent reply rate! Your messages are resonating with recipients.
            </p>
          )}
          {bounceRate === 0 && totalSent > 10 && (
            <p className="text-muted-foreground">
              ✅ No bounces detected. Your email list quality is excellent.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
