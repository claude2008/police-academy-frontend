import UnifiedReportSystem from "@/components/UnifiedReportSystem"
import ProtectedRoute from "@/components/ProtectedRoute"
export default function MilitaryCoursesReportsPage() {
  return (
    <ProtectedRoute allowedRoles={["owner","manager","admin", "military_officer","military_supervisor", "military_trainer"]}>
    <UnifiedReportSystem 
      branch="military" 
      category="courses" // 👈 وهنا أيضاً للطلاب
      pageTitle="تقارير ومخالفات الدورات (عسكري)" 
    />
    </ProtectedRoute>
  )
}