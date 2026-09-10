import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthUser, getOptionalAuthUser } from '@/lib/auth-helper';
import { PAYMENTS_REQUIRED } from '@/lib/payments-config';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';

// GET /api/jobs - Dohvati poslove
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const category = searchParams.get('category');
    const platform = searchParams.get('platform');
    const budgetMin = searchParams.get('budgetMin');
    const budgetMax = searchParams.get('budgetMax');
    const status = searchParams.get('status') || 'open';
    const includeAll = searchParams.get('includeAll') === 'true'; // Admin flag to get all jobs
    const limit = parseInt(searchParams.get('limit') || '50');

    const supabase = createAdminClient();

    // Fetch jobs
    let query = supabase
      .from('jobs')
      .select('id, business_id, title, description, category, platforms, budget_type, budget_min, budget_max, duration, experience_level, application_deadline, status, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (businessId) {
      query = query.eq('business_id', businessId);
      // Sve statuse (draft/pending/closed) sme da vidi samo vlasnik biznisa ili admin.
      // Za javnost ograničavamo na objavljene poslove.
      const viewer = await getOptionalAuthUser();
      const isOwnerOrAdmin = viewer?.role === 'admin' || viewer?.businessId === businessId;
      if (!isOwnerOrAdmin) {
        query = query.in('status', ['open', 'in_progress']);
      }
    } else if (includeAll) {
      const { user } = await getAuthUser();
      if (!user || user.role !== 'admin') {
        return NextResponse.json({ error: 'Admin only' }, { status: 403 });
      }
    } else {
      // Javna lista: dozvoljeni su samo javni statusi (sprečava ?status=pending scraping)
      const publicStatus = status === 'in_progress' ? 'in_progress' : 'open';
      query = query.eq('status', publicStatus);
    }

    // Filter by category
    if (category) {
      query = query.eq('category', category);
    }

    // Filter by platform
    if (platform) {
      query = query.contains('platforms', [platform]);
    }

    // Filter by budget
    if (budgetMin) {
      query = query.gte('budget_max', parseInt(budgetMin));
    }
    if (budgetMax) {
      query = query.lte('budget_min', parseInt(budgetMax));
    }

    const { data: jobs, error } = await query;

    if (error) {
      console.error('Error fetching jobs:', error);
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }

    // Get unique business IDs
    const businessIds = [...new Set((jobs || []).map(j => j.business_id).filter(Boolean))];
    
    // Fetch all business names in ONE query (instead of N queries!)
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, company_name, logo')
      .in('id', businessIds);
    
    // Create lookup map
    const businessMap = new Map(
      (businesses || []).map(b => [b.id, { name: b.company_name, logo: b.logo }])
    );
    
    // Add company names and logos to jobs
    const jobsWithBusiness = (jobs || []).map(job => {
      const business = businessMap.get(job.business_id);
      return {
        ...job,
        companyName: business?.name || '',
        businessLogo: business?.logo || null
      };
    });

    // Format jobs
    const formattedJobs = jobsWithBusiness.map(job => {
      // Check if job has expired deadline
      const isExpired = job.application_deadline && new Date(job.application_deadline) < new Date();
      
      return {
        id: job.id,
        businessId: job.business_id,
        businessName: job.companyName || '',
        businessLogo: job.businessLogo || null,
        title: job.title,
        description: job.description,
        category: job.category,
        platforms: job.platforms || [],
        budgetType: job.budget_type,
        budgetMin: job.budget_min,
        budgetMax: job.budget_max,
        duration: job.duration,
        experienceLevel: job.experience_level,
        applicationDeadline: job.application_deadline,
        isExpired,
        status: job.status,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      };
    });
    
    // For public view, filter out expired jobs (unless businessId is provided)
    const filteredJobs = businessId || includeAll 
      ? formattedJobs 
      : formattedJobs.filter(job => !job.isExpired);

    const response = NextResponse.json({ jobs: filteredJobs });
    
    // No caching - jobs need to be real-time
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    
    return response;

  } catch (error: any) {
    console.error('Jobs fetch error:', error);
    return NextResponse.json({ error: 'Greška na serveru' }, { status: 500 });
  }
}

// POST /api/jobs - Kreiraj novi posao
// ZAŠTIĆENO: Samo ulogovani biznisi SA AKTIVNOM PRETPLATOM mogu kreirati poslove
export async function POST(request: NextRequest) {
  try {
    // 🔒 BEZBEDNOSNA PROVERA: Da li je korisnik ulogovan?
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;
    
    const body = await request.json();
    const {
      businessId,
      title,
      description,
      category,
      platforms,
      budgetType,
      budgetMin,
      budgetMax,
      duration,
      experienceLevel,
      applicationDeadline,
    } = body;

    const userIsAdmin = user?.role === 'admin';

    if (!businessId || !title || !description || !category) {
      return NextResponse.json(
        { error: 'businessId, title, description i category su obavezni' },
        { status: 400 }
      );
    }
    
    // 🔒 BEZBEDNOSNA PROVERA: Biznis može kreirati samo svoje poslove
    if (user?.role === 'business' && user?.businessId !== businessId) {
      return NextResponse.json(
        { error: 'Ne možete kreirati posao u ime drugog biznisa' },
        { status: 403 }
      );
    }

    const supabase = createAdminClient();
    
    // 🔒 BEZBEDNOSNA PROVERA: Biznis mora imati aktivnu pretplatu
    // (isključeno dok je PAYMENTS_REQUIRED false - vidi src/lib/payments-config.ts)
    if (PAYMENTS_REQUIRED && user?.role === 'business' && !userIsAdmin) {
      const { data: business } = await supabase
        .from('businesses')
        .select('subscription_status, expires_at')
        .eq('id', businessId)
        .single();
      
      const hasAccess = business?.subscription_status === 'active' || 
        (business?.expires_at && new Date(business.expires_at) > new Date());
      
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Potrebna je aktivna pretplata za kreiranje poslova' },
          { status: 403 }
        );
      }
    }

    // If admin creates job, it's automatically approved ('open')
    // If business creates job, it needs approval ('pending')
    const initialStatus = userIsAdmin ? 'open' : 'pending';

    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        business_id: businessId,
        title,
        description,
        category,
        platforms: platforms || [],
        budget_type: budgetType || 'fixed',
        budget_min: budgetMin || null,
        budget_max: budgetMax || null,
        duration: duration || null,
        experience_level: experienceLevel || null,
        application_deadline: applicationDeadline || null,
        status: initialStatus,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating job:', error);
      return NextResponse.json({ error: 'Greška pri kreiranju posla' }, { status: 500 });
    }

    console.log('Job created successfully');
    return NextResponse.json({ job, needsApproval: !userIsAdmin });

  } catch (error: any) {
    console.error('Job creation error:', error);
    return NextResponse.json({ error: 'Greška na serveru' }, { status: 500 });
  }
}

// PUT /api/jobs - Ažuriraj posao
// ZAŠTIĆENO: Samo vlasnik posla ili admin može menjati posao
export async function PUT(request: NextRequest) {
  try {
    // 🔒 BEZBEDNOSNA PROVERA: Da li je korisnik ulogovan?
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;
    
    const body = await request.json();
    const { jobId, ...updates } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'jobId je obavezan' }, { status: 400 });
    }

    const supabase = createAdminClient();
    
    // 🔒 BEZBEDNOSNA PROVERA: Dohvati posao i proveri vlasništvo
    const { data: existingJob } = await supabase
      .from('jobs')
      .select('business_id')
      .eq('id', jobId)
      .single();
    
    if (!existingJob) {
      return NextResponse.json({ error: 'Posao nije pronađen' }, { status: 404 });
    }
    
    // Samo vlasnik ili admin može menjati
    if (user?.businessId !== existingJob.business_id && user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Nemate dozvolu za izmenu ovog posla' },
        { status: 403 }
      );
    }

    // Map camelCase to snake_case
    const dbUpdates: any = {};
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.description) dbUpdates.description = updates.description;
    if (updates.category) dbUpdates.category = updates.category;
    if (updates.platforms) dbUpdates.platforms = updates.platforms;
    if (updates.budgetType) dbUpdates.budget_type = updates.budgetType;
    if (updates.budgetMin !== undefined) dbUpdates.budget_min = updates.budgetMin;
    if (updates.budgetMax !== undefined) dbUpdates.budget_max = updates.budgetMax;
    if (updates.duration) dbUpdates.duration = updates.duration;
    if (updates.experienceLevel) dbUpdates.experience_level = updates.experienceLevel;
    if (updates.applicationDeadline !== undefined) dbUpdates.application_deadline = updates.applicationDeadline;
    if (updates.status) {
      // Objavljivanje posla (open/in_progress) je moderacija → samo admin.
      // Biznis ne sme da zaobiđe pending status i sam objavi posao.
      if (user?.role !== 'admin' && ['open', 'in_progress'].includes(updates.status)) {
        return NextResponse.json(
          { error: 'Objavljivanje posla odobrava administrator.' },
          { status: 403 }
        );
      }
      dbUpdates.status = updates.status;
    }
    dbUpdates.updated_at = new Date().toISOString();

    const { data: job, error } = await supabase
      .from('jobs')
      .update(dbUpdates)
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      console.error('Error updating job:', error);
      return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
    }

    return NextResponse.json({ job });

  } catch (error: any) {
    console.error('Job update error:', error);
    return NextResponse.json({ error: 'Greška na serveru' }, { status: 500 });
  }
}

// DELETE /api/jobs - Obriši posao
// ZAŠTIĆENO: Samo vlasnik posla ili admin može obrisati posao
export async function DELETE(request: NextRequest) {
  try {
    // 🔒 BEZBEDNOSNA PROVERA: Da li je korisnik ulogovan?
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;
    
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'jobId je obavezan' }, { status: 400 });
    }

    const supabase = createAdminClient();
    
    // 🔒 BEZBEDNOSNA PROVERA: Dohvati posao i proveri vlasništvo
    const { data: existingJob } = await supabase
      .from('jobs')
      .select('business_id')
      .eq('id', jobId)
      .single();
    
    if (!existingJob) {
      return NextResponse.json({ error: 'Posao nije pronađen' }, { status: 404 });
    }
    
    // Samo vlasnik ili admin može obrisati
    if (user?.businessId !== existingJob.business_id && user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Nemate dozvolu za brisanje ovog posla' },
        { status: 403 }
      );
    }
    
    // 1. First, update all job applications to 'cancelled' status
    const { error: appsError } = await supabase
      .from('job_applications')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('job_id', jobId);
    
    if (appsError) {
      console.error('Error cancelling applications:', appsError);
      // Continue anyway - some tables might not exist
    }
    
    // 2. Update all job invitations to 'cancelled' status
    const { error: invsError } = await supabase
      .from('job_invitations')
      .update({ 
        status: 'cancelled',
        responded_at: new Date().toISOString()
      })
      .eq('job_id', jobId);
    
    if (invsError) {
      console.error('Error cancelling invitations:', invsError);
      // Continue anyway - some tables might not exist
    }
    
    // 3. Instead of hard delete, mark job as deleted (so creators can see what happened)
    const { error } = await supabase
      .from('jobs')
      .update({ 
        status: 'deleted',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (error) {
      console.error('Error deleting job:', error);
      return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Job deletion error:', error);
    return NextResponse.json({ error: 'Greška na serveru' }, { status: 500 });
  }
}

