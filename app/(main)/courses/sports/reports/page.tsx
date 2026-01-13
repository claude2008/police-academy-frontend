import UnifiedReportSystem from "@/components/UnifiedReportSystem"
import ProtectedRoute from "@/components/ProtectedRoute"
export default function SportsCoursesReportsPage() {
  return (
    <ProtectedRoute allowedRoles={["owner","manager","admin","assistant_admin","sports_officer","sports_supervisor", "sports_trainer"]}>
    <UnifiedReportSystem 
      branch="sports" 
      category="courses" // 👈 هذا التغيير سيجعل النظام يفهم أنها تقارير طلاب
      pageTitle="تقارير ومخالفات الدورات (رياضي)" 
    />
    </ProtectedRoute>
  )
}