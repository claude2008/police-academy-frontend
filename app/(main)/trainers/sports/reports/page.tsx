import UnifiedReportSystem from "@/components/UnifiedReportSystem"
import ProtectedRoute from "@/components/ProtectedRoute"
export default function SportsTrainersReportsPage() {
  return (
<ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer","sports_supervisor", "sports_trainer"]}>
    <UnifiedReportSystem 
      branch="sports" 
      category="trainers" 
      pageTitle="تقارير المدربين (رياضي)" 
    />
</ProtectedRoute>
  )
}