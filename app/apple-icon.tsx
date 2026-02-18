import { ImageResponse } from "next/og";

// Route segment config
export const runtime = "edge";

// Image metadata
export const size = {
    width: 180,
    height: 180,
};
export const contentType = "image/png";

// Image generation
export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    fontSize: 128,
                    background: "black",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                }}
            >
                {/* SVG Path from Logo.tsx, scaled/centered */}
                <svg
                    width="128"
                    height="128"
                    viewBox="257 362 1534 1324"
                    fill="currentColor"
                    style={{ width: "70%", height: "70%" }}
                >
                    <path d="M115.9,-661.558 L115.9,-661.64 L105.417,-661.64 C105.405,-661.64 105.393,-661.64 105.381,-661.64 L105.381,-661.64 L-767.021,-661.64 L-767.021,48.0377 L-767.021,661.64 L105.381,661.64 L105.381,661.64 C105.406,661.64 105.431,661.64 105.455,661.64 L115.899,661.64 L115.899,661.558 C476.684,655.947 767.021,362.131 767.021,7.40293e-05 C767.021,-362.131 476.684,-655.946 115.9,-661.558 L115.9,-661.558 Z M-118.592,96.0755 L-118.592,224.583 C-118.592,339.077 -211.067,431.552 -325.561,431.552 C-440.054,431.552 -531.429,339.077 -531.429,224.583 L-531.429,221.281 L-531.429,221.281 L-531.429,96.0755 L-531.429,-221.281 L-531.429,-221.281 L-531.429,-224.583 C-531.429,-339.077 -440.054,-431.552 -325.561,-431.552 C-211.067,-431.552 -118.592,-339.077 -118.592,-224.583 L-118.592,96.0755 L-118.592,96.0755 Z" />
                </svg>
            </div>
        ),
        {
            ...size,
        }
    );
}
