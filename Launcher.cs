using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;

namespace ChessTrainerLauncher
{
    class Program
    {
        [STAThread]
        static void Main()
        {
            string projectDir = AppDomain.CurrentDomain.BaseDirectory;
            string url = "http://127.0.0.1:3000";

            // Check if server is already running
            bool isRunning = IsServerRunning(url);

            if (!isRunning)
            {
                // Start Vite server in background
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "cmd.exe";
                psi.Arguments = "/c npx vite --host 127.0.0.1 --port 3000";
                psi.WorkingDirectory = projectDir;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;

                try
                {
                    Process.Start(psi);
                }
                catch { }

                // Wait up to 5 seconds for server to be responsive
                for (int i = 0; i < 20; i++)
                {
                    Thread.Sleep(250);
                    if (IsServerRunning(url))
                    {
                        break;
                    }
                }
            }

            // Open default browser to app URL
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = url,
                    UseShellExecute = true
                });
            }
            catch { }
        }

        static bool IsServerRunning(string url)
        {
            try
            {
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
                request.Timeout = 800;
                request.Method = "GET";
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    return response.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }
    }
}

