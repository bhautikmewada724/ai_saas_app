import axios from 'axios';
import { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import { createUser, deleteUser, updateUser } from "@/lib/actions/user.actions";

export async function POST(req: Request) {
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
    const CLERK_API_KEY = process.env.CLERK_API_KEY;

    if (!WEBHOOK_SECRET || !CLERK_API_KEY) {
        throw new Error("Please add WEBHOOK_SECRET and CLERK_API_KEY to .env or .env.local");
    }

    const headerPayload = headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
        return new Response("Error occurred -- no svix headers", {
            status: 400,
        });
    }

    const payload = await req.json();
    const body = JSON.stringify(payload);

    const wh = new Webhook(WEBHOOK_SECRET);

    let evt: WebhookEvent;

    try {
        evt = wh.verify(body, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        }) as WebhookEvent;
    } catch (err) {
        console.error("Error verifying webhook:", err);
        return new Response("Error occurred", {
            status: 400,
        });
    }

    const { id }: any = evt.data;
    const eventType = evt.type;

    if (eventType === "user.created") {
        const { email_addresses, image_url, first_name, last_name, username } = evt.data;

        if (!email_addresses || email_addresses.length === 0) {
            return new Response("Error occurred -- no email addresses", { status: 400 });
        }

        const user: any = {
            clerkId: id,
            email: email_addresses[0]?.email_address ?? '',
            username: username ?? '',
            firstName: first_name ?? '',
            lastName: last_name ?? '',
            photo: image_url ?? '',
        };

        try {
            const newUser = await createUser(user);

            if (newUser) {
                await axios.post(
                    `https://api.clerk.dev/v1/users/${id}/metadata`,
                    {
                        publicMetadata: {
                            userId: newUser._id,
                        },
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${CLERK_API_KEY}`,
                            "Content-Type": "application/json",
                        },
                    }
                );
            }

            return NextResponse.json({ message: "OK", user: newUser });
        } catch (error) {
            console.error("Error creating user:", error);
            return new Response("Error occurred while creating user", { status: 500 });
        }
    }


    if (eventType === "user.updated") {
        const { image_url, first_name, last_name, username } = evt.data;

        const user: any = {
            firstName: first_name,
            lastName: last_name,
            username: username!,
            photo: image_url,
        };

        const updatedUser = await updateUser(id, user);

        return NextResponse.json({ message: "OK", user: updatedUser });
    }

    if (eventType === "user.deleted") {
        const deletedUser = await deleteUser(id!);

        return NextResponse.json({ message: "OK", user: deletedUser });
    }

    console.log(`Webhook with an ID of ${id} and type of ${eventType}`);
    console.log("Webhook body:", body);

    return new Response("", { status: 200 });
}
