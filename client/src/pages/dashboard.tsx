import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3, 
  Calendar, 
  DollarSign, 
  PackageIcon, 
  UserRound, 
  Users 
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

interface DashboardStats {
  patientsToday: number;
  incomeToday: number;
  productsSold: number;
  activePackages: number;
}

interface RecentActivity {
  id: number;
  type: string;
  description: string;
  timestamp: string;
}

export default function Dashboard() {
  // Fetch dashboard stats
  const { data: stats = { patientsToday: 0, incomeToday: 0, productsSold: 0, activePackages: 0 } } = 
    useQuery<DashboardStats>({
      queryKey: ['/api/dashboard/stats'],
    });

  // Fetch recent activities
  const { data: activities = [] } = useQuery<RecentActivity[]>({
    queryKey: ['/api/dashboard/activities'],
  });

  // Dashboard stat cards data
  const statCards = [
    {
      title: "Patients Today",
      value: stats.patientsToday,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-100",
    },
    {
      title: "Today's Income",
      value: formatRupiah(stats.incomeToday),
      icon: DollarSign,
      color: "text-green-500",
      bgColor: "bg-green-100",
    },
    {
      title: "Products Sold",
      value: stats.productsSold,
      icon: PackageIcon,
      color: "text-amber-500",
      bgColor: "bg-amber-100",
    },
    {
      title: "Active Packages",
      value: stats.activePackages,
      icon: BarChart3,
      color: "text-purple-500",
      bgColor: "bg-purple-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome to your therapy clinic dashboard.
        </p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={`${card.bgColor} rounded-md p-2`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activities and Today's Schedule */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Recent Activities</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.length > 0 ? (
                activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <div className="rounded-full bg-primary/10 p-2">
                      {activity.type === "patient" && (
                        <UserRound className="h-4 w-4 text-primary" />
                      )}
                      {activity.type === "transaction" && (
                        <DollarSign className="h-4 w-4 text-primary" />
                      )}
                      {activity.type === "appointment" && (
                        <Calendar className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{activity.description}</p>
                      <time className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleString()}
                      </time>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No recent activities
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Today's Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Today's Appointments</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">
                No Appointments Today
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Patient appointments will appear here. Go to the Schedule page to add new appointments.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}