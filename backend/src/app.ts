import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import hpp from "hpp";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

import authRoutes from "./routes/auth.routes";
import employeeRoutes from "./routes/employee.routes";
import attendanceRoutes from "./routes/attendance.routes";
import departmentRoutes from "./routes/department.routes";
import shiftRoutes from "./routes/shift.routes";
import holidayRoutes from "./routes/holiday.routes";
import officeLocationRoutes from "./routes/officeLocation.routes";
import leaveRoutes from "./routes/leave.routes";
import notificationRoutes from "./routes/notification.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import reportRoutes from "./routes/report.routes";

import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware";

dotenv.config();

const app = express();

/* ---------------- Security ---------------- */

app.use(helmet());

/**
 * CLIENT_URL may be a single origin or a comma-separated list, e.g.:
 *   CLIENT_URL=https://attendance.redlecare.in,https://attendance-system.vercel.app
 * This lets prod + a Vercel preview/staging URL both work without
 * reflecting arbitrary origins back (which `origin: true` did).
 */
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server / health checks / curl (no Origin header)
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.includes(origin) ||
        // Allow any Vercel preview deployment for this project
        /^https:\/\/attendance-system-[a-z0-9-]+\.vercel\.app$/.test(origin)
      ) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

app.use(hpp());

app.use(cookieParser());

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

if (process.env.NODE_ENV !== "test") {
  app.use(
    morgan(
      process.env.NODE_ENV === "production"
        ? "combined"
        : "dev"
    )
  );
}

/* ---------------- Rate Limit ---------------- */

const globalLimiter = rateLimit({
  windowMs:
    Number(process.env.RATE_LIMIT_WINDOW_MS) ||
    15 * 60 * 1000,

  max:
    Number(process.env.RATE_LIMIT_MAX) || 200,

  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", globalLimiter);

/* ---------------- Health ---------------- */

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Attendance API Running",
    timestamp: new Date().toISOString(),
  });
});

/* ---------------- API Routes ---------------- */

app.use("/api/auth", authRoutes);

app.use("/api/employees", employeeRoutes);

app.use("/api/attendance", attendanceRoutes);

app.use("/api/departments", departmentRoutes);

app.use("/api/shifts", shiftRoutes);

app.use("/api/holidays", holidayRoutes);

app.use("/api/office-locations", officeLocationRoutes);

app.use("/api/leaves", leaveRoutes);

app.use("/api/notifications", notificationRoutes);

app.use("/api/dashboard", dashboardRoutes);

app.use("/api/reports", reportRoutes);

/* ---------------- React Build ---------------- */

const frontendPath = path.join(
  __dirname,
  "../../frontend/dist"
);

if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

/* ---------------- Errors ---------------- */

app.use(notFoundHandler);

app.use(errorHandler);

export default app;