import UnifiedReportSystem from "@/components/UnifiedReportSystem"
import ProtectedRoute from "@/components/ProtectedRoute"
export default function MilitaryTrainersReportsPage() {
  return (
<ProtectedRoute allowedRoles={["owner","manager","admin", "military_officer","military_supervisor", "military_trainer"]}>
    <UnifiedReportSystem 
      branch="military" 
      category="trainers" 
      pageTitle="تقارير المدربين (عسكري)" 
    />
</ProtectedRoute>
  )
}