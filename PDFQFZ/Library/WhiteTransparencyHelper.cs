using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace PDFQFZ.Library
{
    internal static class WhiteTransparencyHelper
    {
        public static Bitmap Apply(Bitmap src, int tolerance)
        {
            if (src == null)
            {
                throw new ArgumentNullException(nameof(src));
            }

            Bitmap bmp = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb);
            // V1.3.0：部分 PNG 未写 pHYs 分辨率信息，HorizontalResolution/VerticalResolution 为 0，
            // 此时 SetResolution(0,0) 抛 ArgumentException，会把整次盖章/骑缝章准备打断。
            // 去白自 V1.3.0 起为默认开启路径，此处必须自身健壮：分辨率只是 DPI 元数据，
            // 取不到（或赋值抛错）就跳过设置，不影响抠白结果本身。
            try
            {
                if (src.HorizontalResolution > 0f && src.VerticalResolution > 0f)
                {
                    bmp.SetResolution(src.HorizontalResolution, src.VerticalResolution);
                }
            }
            catch
            {
                // 分辨率不可用时忽略
            }
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.DrawImage(src, new Rectangle(0, 0, bmp.Width, bmp.Height));
            }

            Rectangle rect = new Rectangle(0, 0, bmp.Width, bmp.Height);
            BitmapData data = bmp.LockBits(rect, ImageLockMode.ReadWrite, bmp.PixelFormat);

            try
            {
                int bytes = Math.Abs(data.Stride) * bmp.Height;
                byte[] buffer = new byte[bytes];
                Marshal.Copy(data.Scan0, buffer, 0, bytes);

                int threshold = 255 - ClampTolerance(tolerance);
                for (int i = 0; i < buffer.Length; i += 4)
                {
                    byte b = buffer[i];
                    byte g = buffer[i + 1];
                    byte r = buffer[i + 2];

                    if (r > threshold && g > threshold && b > threshold)
                    {
                        buffer[i + 3] = 0;
                    }
                }

                Marshal.Copy(buffer, 0, data.Scan0, bytes);
                return bmp;
            }
            finally
            {
                bmp.UnlockBits(data);
            }
        }

        public static int ClampTolerance(int tolerance)
        {
            if (tolerance < 0)
            {
                return 0;
            }

            if (tolerance > 50)
            {
                return 50;
            }

            return tolerance;
        }
    }
}
