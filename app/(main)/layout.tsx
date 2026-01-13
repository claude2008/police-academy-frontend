// هذا الكود يمرر الصفحات فقط بدون إضافة أي قوائم إضافية
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
    </>
  )
}