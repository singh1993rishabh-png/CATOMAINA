'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/app/utils/supabase/server'

type LoginResponse = {
    error?: string;
    success?: boolean;
}

export async function login(formData: FormData): Promise<LoginResponse> {
    const supabase = await createClient()

    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
    }
    const { error } = await supabase.auth.signInWithPassword(data)

    if (error) {
        // If login fails, send back to login page with error
        return redirect(`/login?error=${encodeURIComponent(error.message)}`)
    }

    // Redirect to dashboard on success
    revalidatePath('/', 'layout')
    redirect('/dashboard')
}

export async function signup(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const firstName = formData.get('Firstname') as string
    const lastName = formData.get('Lastname') as string

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            // This is the CRITICAL part. 
            // It maps your form fields to Supabase User Metadata
            data: {
                first_name: firstName,
                last_name: lastName,
                full_name: `${firstName} ${lastName}`.trim(),
            },
        },
    })

    if (error) {
        return redirect('/login?error=' + encodeURIComponent(error.message))
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
}