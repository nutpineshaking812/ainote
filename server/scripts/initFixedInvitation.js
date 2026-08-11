import InvitationRepository from '../repositories/invitation.repository.js';
import UserRepository from '../repositories/user.repository.js';
import env from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Initialize or update the fixed invitation code in the database
 * This function is called on server startup to ensure the fixed invitation code exists
 */
export async function initFixedInvitation() {
  try {
    const fixedCode = env.FIXED_INVITATION_CODE;

    if (!fixedCode) {
      logger.warn('FIXED_INVITATION_CODE not configured, skipping fixed invitation initialization');
      return;
    }

    // Find or create a system user to be the inviter
    let systemUser = await UserRepository.findOne(); 

    if (!systemUser) {
      logger.info('No users found, fixed invitation will be created without inviter reference');
    }

    // Check if the fixed invitation code already exists
    let fixedInvitation = await InvitationRepository.findByCode(fixedCode);

    if (fixedInvitation) {
      // Update existing fixed invitation to ensure correct settings
      let updates = {};

      if (fixedInvitation.maxUses !== -1) updates.maxUses = -1;
      if (fixedInvitation.status !== 'ACTIVE') updates.status = 'ACTIVE';
      if (fixedInvitation.type !== 'PLATFORM') updates.type = 'PLATFORM';
      if (fixedInvitation.targetOrganizationId !== null) updates.targetOrganizationId = null;
      if (fixedInvitation.expiresAt !== null && fixedInvitation.expiresAt !== undefined) updates.expiresAt = null;

      if (systemUser && fixedInvitation.inviter !== systemUser.id) {
        updates.inviter = systemUser.id;
      }

      if (Object.keys(updates).length > 0) {
        await InvitationRepository.update(fixedInvitation.id, updates);
        logger.info(
          { code: fixedCode, uses: fixedInvitation.uses },
          'Fixed invitation code updated',
        );
      } else {
        logger.info(
          { code: fixedCode, uses: fixedInvitation.uses },
          'Fixed invitation code already exists and is up to date',
        );
      }
    } else {
      // Create new fixed invitation code
      const inviterId = systemUser ? systemUser.id : 'SYSTEM'; // Fallback to 'SYSTEM' string for Postgres if no user

      await InvitationRepository.create({
        code: fixedCode,
        inviter: inviterId,
        targetOrganizationId: null,
        type: 'PLATFORM',
        maxUses: -1, // Unlimited uses
        status: 'ACTIVE',
        expiresAt: null, // Never expires
      });

      logger.info({ code: fixedCode }, 'Fixed invitation code created successfully');
    }
  } catch (error) {
    logger.error({ err: error }, 'Error initializing fixed invitation code');
  }
}

/**
 * Script to manually initialize the fixed invitation code
 */
async function runScript() {
  try {
    await initFixedInvitation();
    console.log('✅ Fixed invitation initialization complete');
    process.exit(0);
  } catch (err) {
    console.error('Error during fixed invitation initialization:', err);
    process.exit(1);
  }
}

// If this script is run directly (not imported), execute the initialization
if (import.meta.url === `file://${process.argv[1]}`) {
  runScript();
}
